/**
 * Policies tools for the Parallels RAS MCP Server.
 * Provides read-only access to RAS client policy configuration.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only policy tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  server.registerTool(
    "ras_policies_list",
    {
      title: "Client Policies",
      description:
        "List all Parallels RAS client policies, including policy names, settings, " +
        "and assignment status. Client policies control user experience settings " +
        "such as display, audio, printing, and device redirection. Use this to " +
        "audit policy configuration or troubleshoot client behaviour issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/ClientPolicies");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve policies") }], isError: true };
      }
    }
  );
}
