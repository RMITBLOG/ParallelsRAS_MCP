/**
 * Shared concerns for read-only RAS tools.
 *
 * Provides three things every tool file uses:
 *
 *   - **`formatList(data, opts)`** — response shaping. For array responses:
 *     row cap (default 50, hard max 200), top-level field projection, and
 *     equality filter (AND across keys; strings case-insensitive). For any
 *     response: a 64 KB byte safety net so a runaway payload can't blow
 *     the model's context window in one call.
 *   - **`LIST_INPUT_SCHEMA`** — the Zod raw shape (`fields`, `filter`, `limit`)
 *     advertised by every list tool. Centralised so wording stays identical.
 *   - **`registerListTool` / `registerObjectTool`** — registration factories
 *     that fold the GET → JSON → MCP-text-content pattern into one place.
 *     A list tool becomes five lines instead of twenty.
 *
 * Top-level fields only by design. Nested-path support, if ever needed,
 * belongs here — not duplicated across handlers.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { rasClient, sanitiseError } from "../client.js";

// ── Tool annotations ────────────────────────────────────────────────────

/** Read-only annotations applied to every GET tool. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// ── List shape options ──────────────────────────────────────────────────

export interface ListShapeOptions {
  /** Project each row down to these top-level keys. Unknown keys are dropped. */
  fields?: string[];
  /** Keep rows where every key matches (AND). Strings compared case-insensitive. */
  filter?: Record<string, string | number | boolean>;
  /** Max rows to return after filtering. Default 50, capped at 200. */
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const BYTE_SAFETY_CAP = 64 * 1024;

/** Shared input schema for list-style tools. Spread into `inputSchema`. */
export const LIST_INPUT_SCHEMA = {
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "Top-level keys to keep on each row. Unknown keys are dropped. " +
        "Use this to shrink large responses to only the columns you need.",
    ),
  filter: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe(
      "Equality filter on top-level fields (AND across keys). " +
        "String values match case-insensitively.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "Max rows after filtering. Default 50, max 200. " +
        "Prefer narrowing with `filter` over raising the limit.",
    ),
};

// ── Response shaping ────────────────────────────────────────────────────

function matches(
  row: unknown,
  filter: Record<string, string | number | boolean>,
): boolean {
  if (typeof row !== "object" || row === null) return false;
  const obj = row as Record<string, unknown>;
  for (const [key, want] of Object.entries(filter)) {
    const got = obj[key];
    if (typeof want === "string" && typeof got === "string") {
      if (want.toLowerCase() !== got.toLowerCase()) return false;
    } else if (got !== want) {
      return false;
    }
  }
  return true;
}

function project(row: unknown, fields: string[]): unknown {
  if (typeof row !== "object" || row === null) return row;
  const obj = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in obj) out[f] = obj[f];
  }
  return out;
}

function capBytes(body: string, hints: string[]): string {
  if (body.length <= BYTE_SAFETY_CAP) return body;
  hints.push(
    `output truncated at ${BYTE_SAFETY_CAP} bytes; use 'fields' to project a smaller subset`,
  );
  return body.substring(0, BYTE_SAFETY_CAP);
}

/**
 * Shape a list response into MCP text content. For non-array responses,
 * falls back to plain pretty-printed JSON (with the same byte safety net),
 * so single-object endpoints stay safe without extra wiring.
 */
export function formatList(data: unknown, opts: ListShapeOptions = {}): string {
  if (!Array.isArray(data)) {
    const hints: string[] = [];
    const body = capBytes(JSON.stringify(data, null, 2), hints);
    return hints.length === 0 ? body : `NOTE: ${hints.join("; ")}.\n\n${body}`;
  }

  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const total = data.length;
  let rows: unknown[] = opts.filter
    ? data.filter((r) => matches(r, opts.filter!))
    : data.slice();
  const matched = rows.length;

  const truncatedByRowCap = rows.length > limit;
  if (truncatedByRowCap) rows = rows.slice(0, limit);

  if (opts.fields && opts.fields.length > 0) {
    rows = rows.map((r) => project(r, opts.fields!));
  }

  const hints: string[] = [];
  if (opts.filter) hints.push(`filter matched ${matched} of ${total} rows`);
  else hints.push(`${total} rows total`);
  if (truncatedByRowCap) {
    hints.push(
      `showing first ${limit}; narrow with filter or raise limit (max ${MAX_LIMIT})`,
    );
  }

  const body = capBytes(JSON.stringify(rows, null, 2), hints);
  return `NOTE: ${hints.join("; ")}.\n\n${body}`;
}

// ── Registration factories ──────────────────────────────────────────────

export interface ToolDef {
  /** Tool name (e.g. `ras_infra_get_agents`). */
  name: string;
  /** Short human-readable title. */
  title: string;
  /** Description shown to the model. Keep focused on *what*; params self-document. */
  description: string;
  /** RAS REST API path (e.g. `/api/Agent`). */
  path: string;
  /** Context prefix for sanitised error messages. */
  errorContext: string;
}

/**
 * Register a list-style tool: advertises `LIST_INPUT_SCHEMA` and pipes the
 * GET response through `formatList`.
 */
export function registerListTool(server: McpServer, def: ToolDef): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: LIST_INPUT_SCHEMA,
    },
    async ({ fields, filter, limit }) => {
      try {
        const data = await rasClient.get(def.path);
        return {
          content: [
            {
              type: "text" as const,
              text: formatList(data, { fields, filter, limit }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: sanitiseError(err, def.errorContext) },
          ],
          isError: true,
        };
      }
    },
  );
}

/**
 * Register a single-object tool: no input schema, but still routes through
 * `formatList` so the byte safety net applies.
 */
export function registerObjectTool(server: McpServer, def: ToolDef): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get(def.path);
        return {
          content: [{ type: "text" as const, text: formatList(data) }],
        };
      } catch (err) {
        return {
          content: [
            { type: "text" as const, text: sanitiseError(err, def.errorContext) },
          ],
          isError: true,
        };
      }
    },
  );
}
