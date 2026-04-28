/**
 * Streamable-HTTP transport for the Parallels RAS MCP server.
 *
 * Wraps the SDK's StreamableHTTPServerTransport in a small Node http
 * listener with a bearer-token auth check. Stateless mode (no session
 * IDs) — fine for a read-only query surface where every POST stands
 * alone.
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
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function startHttpTransport(server: McpServer): Promise<void> {
  const token = process.env.MCP_HTTP_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "MCP_HTTP_BEARER_TOKEN is required when MCP_TRANSPORT=http. " +
      "Generate one with `openssl rand -hex 32` and set it in your environment."
    );
  }

  const host = process.env.MCP_HTTP_HOST ?? DEFAULT_HOST;
  const port = Number(process.env.MCP_HTTP_PORT ?? DEFAULT_PORT);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

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
    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("HTTP transport error:", msg);
      if (!res.headersSent) send(res, 500, { error: "internal error" });
    }
  });

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
