/**
 * Policies tools for the Parallels RAS MCP Server.
 * Read-only access to RAS client policy configuration.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool } from "./_format.js";

export function register(server: McpServer): void {
  registerListTool(server, {
    name: "ras_policies_list",
    title: "Client Policies",
    description:
      "List all Parallels RAS client policies — policy names, settings, and " +
      "assignment status. Client policies control user experience settings " +
      "(display, audio, printing, device redirection). Use this to audit " +
      "policy configuration or troubleshoot client behaviour. Policies can be " +
      "deeply nested — use `fields` to project only top-level metadata when " +
      "you don't need every rule.",
    path: "/api/ClientPolicies",
    errorContext: "Failed to retrieve policies",
  });
}
