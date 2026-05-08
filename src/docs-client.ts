/**
 * Parallels Documentation MCP client for the RAS MCP Server.
 * Bridges read-only doc lookups to the upstream GitBook-hosted MCP server at
 *   https://docs.parallels.com/landing/~gitbook/mcp
 * Communicates via JSON-RPC 2.0 over streamable HTTP (SSE-framed responses).
 *
 * @author Ryan Mangan
 * @created 2026-05-08
 */

const DOCS_MCP_URL = "https://docs.parallels.com/landing/~gitbook/mcp";
const DOCS_TIMEOUT_MS = 30_000;

/** Single text/markdown chunk returned by the upstream documentation tools. */
export type DocsContent = { type: "text"; text: string };

let nextId = 1;

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
    signal: AbortSignal.timeout(DOCS_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `docs MCP HTTP ${response.status}: ${body.substring(0, 300)}`
    );
  }

  const body = await response.text();
  const result = parseSseJsonRpc(body, id) as
    | { content?: DocsContent[]; isError?: boolean }
    | undefined;

  if (!result || !Array.isArray(result.content)) {
    throw new Error("docs MCP returned no content");
  }
  if (result.isError) {
    const msg = result.content.map((c) => c.text).join(" ").substring(0, 300);
    throw new Error(`docs MCP tool error: ${msg}`);
  }
  return result.content;
}
