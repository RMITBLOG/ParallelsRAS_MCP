/**
 * Farm settings tools for the Parallels RAS MCP Server.
 * Provides read-only access to farm configuration, licensing, admin accounts,
 * performance monitoring, reporting, and mailbox settings.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only farm settings tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  // ── Administrators ──────────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_administrators",
    {
      title: "Farm Administrators",
      description:
        "List RAS farm administrator accounts, including usernames, roles, permissions, " +
        "and group membership. Use this to audit admin access, verify role assignments, " +
        "or review who has administrative control of the farm.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/AdminAccount");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve administrators") }], isError: true };
      }
    }
  );

  // ── Farm Config ─────────────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_config",
    {
      title: "Farm Configuration",
      description:
        "Get RAS farm configuration settings, including farm name, domain, backup " +
        "settings, and global options. Use this to review the overall farm setup, " +
        "verify domain configuration, or check backup scheduling.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/FarmSettings");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve farm config") }], isError: true };
      }
    }
  );

  // ── Licensing ───────────────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_licensing",
    {
      title: "Licensing",
      description:
        "Get RAS licensing status, including license type (subscription/perpetual), " +
        "expiration date, seat count, usage, and activation status. Use this to check " +
        "license compliance, verify capacity, or diagnose licensing issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/License");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve licensing info") }], isError: true };
      }
    }
  );

  // ── Web Service Version ─────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_version",
    {
      title: "Web Service Version",
      description:
        "Get the RAS web service (REST API) version information. Returns the " +
        "current API version and build number. Use this to verify the API version " +
        "is compatible or check which features are available.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/WebService/version");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve version info") }], isError: true };
      }
    }
  );

  // ── Performance Monitor ─────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_performance",
    {
      title: "Performance Monitor",
      description:
        "Get performance monitor configuration and counters for the RAS farm. " +
        "Includes resource utilisation thresholds and monitoring settings. Use this " +
        "to review performance baselines or check monitoring configuration.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/PerformanceMonitor");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve performance monitor") }], isError: true };
      }
    }
  );

  // ── Mailbox ─────────────────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_mailbox",
    {
      title: "Mailbox Settings",
      description:
        "Get the SMTP mailbox configuration used for RAS email notifications, " +
        "including server address, port, and sender details. Use this to verify " +
        "email notification settings or troubleshoot notification delivery failures.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/MailboxSettings");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve mailbox settings") }], isError: true };
      }
    }
  );

  // ── Reporting ───────────────────────────────────────────────────────
  server.registerTool(
    "ras_farm_get_reporting",
    {
      title: "Reporting",
      description:
        "Get reporting configuration for the RAS farm, including report scheduling, " +
        "data retention, and database connection settings. Use this to verify " +
        "reporting is enabled and properly configured.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Reporting");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve reporting config") }], isError: true };
      }
    }
  );
}
