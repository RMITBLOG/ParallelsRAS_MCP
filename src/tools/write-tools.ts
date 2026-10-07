import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sanitiseError } from "../client.js";
import { formatList, READ_ONLY_ANNOTATIONS } from "./_format.js";
import { executeWrite, isWriteEnabled, listWriteOperations, WRITE_INPUT_SCHEMA } from "../write.js";
import { WRITE_OPERATIONS } from "../write-operations.js";

export function registerWriteTools(server: McpServer): void {
  if (!isWriteEnabled()) return;

  server.registerTool(
    "ras_write_operations",
    {
      title: "Find documented RAS write operations",
      description: "Search the Parallels RAS v21.2 POST, PUT, and DELETE operation catalog. Returns method and path templates for ras_write_request.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        search: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ search, limit, offset }) => {
      try {
        return {
          content: [{ type: "text" as const, text: formatList({
            totalOperations: WRITE_OPERATIONS.length,
            matches: listWriteOperations(search, limit, offset),
          }) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: sanitiseError(error, "Write catalog failed") }], isError: true };
      }
    },
  );

  server.registerTool(
    "ras_write_request",
    {
      title: "Change Parallels RAS configuration",
      description: "Execute one documented RAS v21.2 POST, PUT, or DELETE request. Requires RAS_ENABLE_WRITE=true. This can be destructive or interrupt users. Use ras_write_operations and the official endpoint documentation to construct the request. Some configuration changes need a separate POST /api/Settings/apply call. Write requests are never retried automatically.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: WRITE_INPUT_SCHEMA,
    },
    async (input) => {
      try {
        return { content: [{ type: "text" as const, text: formatList(await executeWrite(input)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: sanitiseError(error, "RAS write failed") }], isError: true };
      }
    },
  );
}
