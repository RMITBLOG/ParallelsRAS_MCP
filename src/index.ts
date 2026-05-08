/**
 * Parallels RAS MCP Server — Entry Point
 * A read-only MCP server for querying Parallels RAS infrastructure via the REST API.
 *
 * Transport selection via MCP_TRANSPORT env var:
 *   - "stdio" (default): launched as a subprocess by the MCP client (Claude
 *     Desktop, Claude Code, Cursor). Local use only.
 *   - "http": streamable-HTTP listener with bearer-token auth. Intended for
 *     trusted-network deployments fronted by TLS termination.
 *
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateConfig } from "./client.js";
import { startHttpTransport } from "./transports/http.js";

import { register as registerInfrastructure } from "./tools/infrastructure.js";
import { register as registerSiteSettings } from "./tools/site-settings.js";
import { register as registerPolicies } from "./tools/policies.js";
import { register as registerFarmSettings } from "./tools/farm-settings.js";
import { register as registerPublishing } from "./tools/publishing.js";
import { register as registerRdSessions } from "./tools/rd-sessions.js";
import { register as registerDocumentation } from "./tools/documentation.js";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "parallels-ras",
    version: "1.0.0",
  });
  registerInfrastructure(server);
  registerSiteSettings(server);
  registerPolicies(server);
  registerFarmSettings(server);
  registerPublishing(server);
  registerRdSessions(server);
  registerDocumentation(server);
  return server;
}

async function main() {
  validateConfig();

  const transport = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
  const server = buildServer();

  if (transport === "http") {
    await startHttpTransport(server);
    return;
  }

  if (transport !== "stdio") {
    throw new Error(
      `Unknown MCP_TRANSPORT="${transport}". Expected "stdio" or "http".`
    );
  }

  await server.connect(new StdioServerTransport());
  console.error("Parallels RAS MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
