/**
 * RD Sessions tools for the Parallels RAS MCP Server.
 * Provides read-only access to active remote desktop sessions.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only session tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  server.registerTool(
    "ras_sessions_list",
    {
      title: "Active RD Sessions",
      description:
        "List all active remote desktop sessions across the RAS farm, including " +
        "username, client IP address, device name, session state, screen resolution, " +
        "and connected server. Use this to monitor active users, check session counts, " +
        "troubleshoot user connectivity, or identify idle/disconnected sessions.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/rd-sessions");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve RD sessions") }], isError: true };
      }
    }
  );
}
