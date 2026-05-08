/**
 * Parallels Documentation tools for the RAS MCP Server.
 * Read-only access to the official Parallels documentation, useful when
 * validating findings from live RAS data against documented behaviour.
 * Backed by the upstream GitBook MCP server at docs.parallels.com.
 *
 * @author Ryan Mangan
 * @created 2026-05-08
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sanitiseError } from "../client.js";
import { callDocsTool } from "../docs-client.js";

/** Shared annotations for all read-only documentation tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  server.registerTool(
    "ras_docs_search",
    {
      title: "Search Parallels Documentation",
      description:
        "Search the official Parallels documentation for relevant pages, code " +
        "examples, API references, and feature guides. Use this to validate " +
        "configuration found via the RAS API tools, look up the documented " +
        "behaviour of a feature, or find the right page before fetching it in " +
        "full with ras_docs_get_page. Returns one or more excerpts with titles " +
        "and direct links.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Search terms — feature names, error text, settings, etc."),
      },
    },
    async ({ query }) => {
      try {
        const content = await callDocsTool("searchDocumentation", { query });
        return { content };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: sanitiseError(err, "Failed to search Parallels documentation"),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "ras_docs_get_page",
    {
      title: "Get Parallels Documentation Page",
      description:
        "Fetch the full markdown content of a specific Parallels documentation " +
        "page. Use after ras_docs_search when you need the complete page " +
        "(prerequisites, full procedure, all options) rather than excerpts. " +
        "Accepts a full https://docs.parallels.com/... URL.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        url: z
          .string()
          .url()
          .describe("Full URL of the docs.parallels.com page to fetch."),
      },
    },
    async ({ url }) => {
      try {
        const content = await callDocsTool("getPage", { url });
        return { content };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: sanitiseError(err, "Failed to fetch Parallels documentation page"),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
