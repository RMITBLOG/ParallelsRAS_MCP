/**
 * RD Sessions tools for the Parallels RAS MCP Server.
 * Read-only access to active remote desktop sessions, with optional field
 * projection, equality filtering, and a row cap so busy farms don't return
 * thousands of session rows in one call.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool, type ToolDef } from "./_format.js";

export const TOOLS: ToolDef[] = [
  {
    name: "ras_sessions_list",
    title: "Active RD Sessions",
    description:
      "List active remote desktop sessions across the RAS farm — username, " +
      "client IP, device name, state, screen resolution, and connected server. " +
      "Use this to monitor active users, check session counts, troubleshoot " +
      "connectivity, or identify idle/disconnected sessions. Supports " +
      "`fields`, `filter`, and `limit` — prefer narrowing over fetching " +
      "everything on large farms.",
    path: "/api/RDSession",
    errorContext: "Failed to retrieve RD sessions",
  },
];

export function register(server: McpServer): void {
  for (const def of TOOLS) registerListTool(server, def);
}
