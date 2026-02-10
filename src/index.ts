/**
 * Parallels RAS MCP Server — Entry Point
 * A read-only MCP server for querying Parallels RAS infrastructure via the REST API.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateConfig } from "./client.js";

import { register as registerInfrastructure } from "./tools/infrastructure.js";
import { register as registerSiteSettings } from "./tools/site-settings.js";
import { register as registerPolicies } from "./tools/policies.js";
import { register as registerFarmSettings } from "./tools/farm-settings.js";
import { register as registerPublishing } from "./tools/publishing.js";
import { register as registerRdSessions } from "./tools/rd-sessions.js";
import { register as registerHelpSupport } from "./tools/help-support.js";

const server = new McpServer({
  name: "parallels-ras",
  version: "1.0.0",
});

// Register all tool modules
registerInfrastructure(server);
registerSiteSettings(server);
registerPolicies(server);
registerFarmSettings(server);
registerPublishing(server);
registerRdSessions(server);
registerHelpSupport(server);

async function main() {
  // Validate required env vars before starting the transport
  validateConfig();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Parallels RAS MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
