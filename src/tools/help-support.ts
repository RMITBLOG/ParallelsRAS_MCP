/**
 * Help & Support tools for the Parallels RAS MCP Server.
 * Provides read-only access to support information and helpdesk configuration.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only support tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  server.registerTool(
    "ras_support_info",
    {
      title: "Support Information",
      description:
        "Get Parallels RAS support information, including support contact details, " +
        "product version, build number, and support entitlement. Use this to check " +
        "the installed RAS version, verify support status, or gather information " +
        "for a support ticket.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/help-and-support/support");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve support info") }], isError: true };
      }
    }
  );
}
