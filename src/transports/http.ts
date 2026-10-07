/**
 * Streamable-HTTP transport for the Parallels RAS MCP server.
 *
 * Wraps the SDK's StreamableHTTPServerTransport in a small Node http
 * listener with a bearer-token auth check. Stateless mode (no session
 * IDs), so every POST has its own MCP context.
 *
 * Security posture: this server holds RAS admin credentials, so the
 * bearer token is required and the listener defaults to 127.0.0.1.
 * Operators must consciously set MCP_HTTP_HOST to expose it.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const MCP_PATH = "/mcp";
const WRITE_ENABLED = (process.env.RAS_ENABLE_WRITE ?? "false").toLowerCase() === "true";
const MAX_BODY_BYTES = WRITE_ENABLED ? 12 * 1024 * 1024 : 1024 * 1024;
const MAX_BATCH_ITEMS = 25;
const MAX_CONCURRENT_REQUESTS = WRITE_ENABLED ? 4 : 16;
let activeRequests = 0;

type ServerFactory = () => McpServer;

class RequestBodyTooLargeError extends RangeError {}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function checkAuth(req: IncomingMessage, expectedToken: string): boolean {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;
  return constantTimeEquals(header.slice("Bearer ".length).trim(), expectedToken);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBoundedJson(req: IncomingMessage): Promise<unknown> {
  const declaredLength = req.headers["content-length"];
  if (declaredLength !== undefined) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new SyntaxError("invalid Content-Length");
    }
    if (length > MAX_BODY_BYTES) throw new RequestBodyTooLargeError("request body too large");
  }

  const bodyBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("aborted", onAborted);
      req.removeListener("error", onError);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        cleanup();
        req.pause();
        reject(new RequestBodyTooLargeError("request body too large"));
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, totalBytes));
    };
    const onAborted = () => {
      cleanup();
      reject(new Error("request aborted"));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    req.on("data", onData);
    req.once("end", onEnd);
    req.once("aborted", onAborted);
    req.once("error", onError);
  });

  const body = JSON.parse(bodyBuffer.toString("utf8")) as unknown;
  if (Array.isArray(body) && body.length > MAX_BATCH_ITEMS) {
    throw new RangeError("JSON-RPC batch too large");
  }
  return body;
}

export async function startHttpTransport(createMcpServer: ServerFactory): Promise<void> {
  const token = process.env.MCP_HTTP_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "MCP_HTTP_BEARER_TOKEN is required when MCP_TRANSPORT=http. " +
      "Generate one with `openssl rand -hex 32` and set it in your environment."
    );
  }
  if (WRITE_ENABLED && Buffer.byteLength(token, "utf8") < 32) {
    throw new Error("MCP_HTTP_BEARER_TOKEN must contain at least 32 bytes when RAS_ENABLE_WRITE=true");
  }

  const host = process.env.MCP_HTTP_HOST ?? DEFAULT_HOST;
  const port = Number(process.env.MCP_HTTP_PORT ?? DEFAULT_PORT);

  const httpServer = createServer(async (req, res) => {
    if (req.url !== MCP_PATH) {
      send(res, 404, { error: "not found" });
      return;
    }
    if (!checkAuth(req, token)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="parallels-ras-mcp"');
      send(res, 401, { error: "unauthorized" });
      return;
    }

    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      res.setHeader("Retry-After", "1");
      send(res, 503, { error: "server busy" });
      return;
    }

    activeRequests += 1;
    let server: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        if (server?.isConnected()) await server.close();
        else await transport?.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("HTTP transport cleanup error:", msg);
      }
    };
    res.once("close", () => {
      void cleanup();
    });
    try {
      let parsedBody: unknown;
      if (req.method === "POST") {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          send(res, 415, { error: "content type must be application/json" });
          return;
        }
        try {
          parsedBody = await readBoundedJson(req);
        } catch (err) {
          if (err instanceof RequestBodyTooLargeError) {
            res.setHeader("Connection", "close");
            res.once("finish", () => req.destroy());
            send(res, 413, { error: err.message });
          } else if (err instanceof RangeError) {
            send(res, 413, { error: err.message });
          } else {
            send(res, 400, { error: "invalid JSON request body" });
          }
          return;
        }
      } else if (req.headers["content-length"] || req.headers["transfer-encoding"]) {
        res.setHeader("Connection", "close");
        res.once("finish", () => req.destroy());
        send(res, 413, { error: "request bodies are only accepted for POST" });
        return;
      }

      server = createMcpServer();
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("HTTP transport error:", msg);
      if (!res.headersSent) send(res, 500, { error: "internal error" });
    } finally {
      activeRequests -= 1;
      if (res.writableEnded || res.destroyed) await cleanup();
    }
  });

  httpServer.headersTimeout = 10_000;
  httpServer.requestTimeout = 30_000;
  httpServer.keepAliveTimeout = 5_000;
  httpServer.maxHeadersCount = 100;

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  console.error(
    `Parallels RAS MCP Server listening on http://${host}:${port}${MCP_PATH} ` +
    `(bearer-token auth required)`
  );

  if (host === "0.0.0.0" || host === "::") {
    console.error(
      "WARNING: bound to all interfaces. Ensure the bearer token is strong " +
      "and the network path is trusted (VPN, firewall, reverse proxy with TLS)."
    );
  }
}
