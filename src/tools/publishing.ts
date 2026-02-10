/**
 * Publishing tools for the Parallels RAS MCP Server.
 * Provides read-only access to published applications, desktops, folders,
 * and publishing status across RDS, VDI, and AVD resource types.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only publishing tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  // ── Published RDS Apps ──────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_rds_apps",
    {
      title: "Published RDS Apps",
      description:
        "List published RDS (Remote Desktop Services) applications, including app " +
        "names, executable paths, server associations, and user filter assignments. " +
        "Use this to review which applications are published via RDS, check app " +
        "configurations, or troubleshoot application launch issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/apps/rds");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve published RDS apps") }], isError: true };
      }
    }
  );

  // ── Published VDI Apps ──────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_vdi_apps",
    {
      title: "Published VDI Apps",
      description:
        "List published VDI (Virtual Desktop Infrastructure) applications. VDI apps " +
        "run on dedicated virtual machines rather than shared RDS hosts. Use this to " +
        "review VDI-published applications or compare with RDS app assignments.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/apps/vdi");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve published VDI apps") }], isError: true };
      }
    }
  );

  // ── Published AVD Apps ──────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_avd_apps",
    {
      title: "Published AVD Apps",
      description:
        "List published Azure Virtual Desktop (AVD) applications. AVD apps are " +
        "delivered from Azure-hosted session hosts. Use this to review AVD app " +
        "assignments or verify Azure-based application publishing.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/apps/avd");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve published AVD apps") }], isError: true };
      }
    }
  );

  // ── Published Desktops ──────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_desktops",
    {
      title: "Published Desktops",
      description:
        "List published desktop resources, including full desktops available to " +
        "users via RDS, VDI, or AVD. Use this to review desktop assignments, " +
        "check which desktop types are published, or verify user access.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/desktops");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve published desktops") }], isError: true };
      }
    }
  );

  // ── Folders ─────────────────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_folders",
    {
      title: "Publishing Folders",
      description:
        "List published resource folders that organise applications and desktops " +
        "into logical groups for end users. Use this to review the folder hierarchy, " +
        "check resource organisation, or verify folder-level access settings.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/folders");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve publishing folders") }], isError: true };
      }
    }
  );

  // ── Publishing Status ───────────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_status",
    {
      title: "Publishing Status",
      description:
        "Get the overall publishing service status and health. Returns whether " +
        "the publishing agent is operational and any pending changes. Use this to " +
        "verify publishing is functioning or diagnose why resources are unavailable.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing/status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve publishing status") }], isError: true };
      }
    }
  );

  // ── Published Items (All) ───────────────────────────────────────────
  server.registerTool(
    "ras_pub_get_all_items",
    {
      title: "All Published Items",
      description:
        "List all published items across all resource types (RDS, VDI, AVD apps " +
        "and desktops) in a single view. Use this for a complete overview of " +
        "everything published in the farm, or to search across all resource types.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/publishing");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve all published items") }], isError: true };
      }
    }
  );
}
