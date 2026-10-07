/**
 * Parallels Documentation MCP client for the RAS MCP Server.
 * Bridges read-only doc lookups to the upstream GitBook-hosted MCP server at
 *   https://docs.parallels.com/landing/~gitbook/mcp
 * Communicates via JSON-RPC 2.0 over streamable HTTP (SSE-framed responses).
 *
 * @author Ryan Mangan
 * @created 2026-05-08
 */

import { readResponseText, truncateUtf8 } from "./http-body.js";

const DOCS_MCP_URL = "https://docs.parallels.com/landing/~gitbook/mcp";
const DOCS_TIMEOUT_MS = 30_000;
const DOCS_RESPONSE_LIMIT_BYTES = 1024 * 1024;
const DOCS_OUTPUT_LIMIT_BYTES = 64 * 1024;

export function isAllowedDocsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "docs.parallels.com" &&
      (url.port === "" || url.port === "443") &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

/** Single text/markdown chunk returned by the upstream documentation tools. */
export type DocsContent = { type: "text"; text: string };

let nextId = 1;

/** Apply one encoded-byte ceiling across all returned documentation chunks. */
function capDocsContent(content: DocsContent[]): DocsContent[] {
  const suffix = "\n\n[Documentation output truncated at 65536 bytes.]";
  const suffixBytes = Buffer.byteLength(suffix, "utf8");
  const result: DocsContent[] = [];
  let remaining = DOCS_OUTPUT_LIMIT_BYTES;

  for (const item of content) {
    if (remaining === 0) break;
    if (item.type !== "text" || typeof item.text !== "string") continue;
    const itemBytes = Buffer.byteLength(item.text, "utf8");
    if (itemBytes <= remaining) {
      result.push(item);
      remaining -= itemBytes;
      continue;
    }

    const available = Math.max(0, remaining - suffixBytes);
    const truncated = truncateUtf8(item.text, available);
    result.push({
      type: "text",
      text:
        truncated +
        truncateUtf8(suffix, Math.max(0, remaining - Buffer.byteLength(truncated, "utf8"))),
    });
    remaining = 0;
    break;
  }

  return result;
}

/**
 * Parse an SSE-framed JSON-RPC response body and return the `result` field
 * for the request whose id we sent. Throws on JSON-RPC error or malformed body.
 */
function parseSseJsonRpc(body: string, expectedId: number): unknown {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    let parsed: { id?: number; result?: unknown; error?: { code: number; message?: string } };
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    if (parsed.id !== expectedId) continue;
    if (parsed.error) {
      throw new Error(
        `docs MCP error ${parsed.error.code}: ${parsed.error.message ?? "unknown"}`
      );
    }
    return parsed.result;
  }
  throw new Error("docs MCP returned no JSON-RPC response for the request");
}

/**
 * Invoke an upstream documentation tool and return its content array.
 * Both upstream tools currently return one or more `{type: "text", text}` chunks.
 */
export async function callDocsTool(
  name: string,
  args: Record<string, unknown>
): Promise<DocsContent[]> {
  const id = nextId++;
  const response = await fetch(DOCS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    redirect: "error",
    signal: AbortSignal.timeout(DOCS_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`docs MCP HTTP ${response.status}`);
  }

  const body = await readResponseText(response, DOCS_RESPONSE_LIMIT_BYTES);
  const result = parseSseJsonRpc(body, id) as
    | { content?: DocsContent[]; isError?: boolean }
    | undefined;

  if (!result || !Array.isArray(result.content)) {
    throw new Error("docs MCP returned no content");
  }
  if (result.isError) {
    throw new Error("docs MCP tool returned an error");
  }
  return capDocsContent(result.content);
}
