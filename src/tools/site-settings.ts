/**
 * Site settings tools for the Parallels RAS MCP Server.
 * Provides read-only access to AD integration, connection settings, FSLogix,
 * load balancing, MFA, printing, notifications, URL redirection, and tenant broker.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only site settings tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  // ── AD Integration ──────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_ad_integration",
    {
      title: "AD Integration",
      description:
        "Get Active Directory integration configuration, including domain settings, " +
        "forest trust relationships, and OU mappings. Use this to verify AD connectivity, " +
        "check domain join status, or troubleshoot authentication issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/ad-integration");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve AD integration") }], isError: true };
      }
    }
  );

  // ── Connection Settings ─────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_connection_settings",
    {
      title: "Connection Settings",
      description:
        "Get connection and authentication settings, including session timeouts, " +
        "client connection policies, and authentication methods. Use this to review " +
        "security posture or troubleshoot client connection issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/connection-and-authentication/connection-settings");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve connection settings") }], isError: true };
      }
    }
  );

  // ── FSLogix ─────────────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_fslogix",
    {
      title: "FSLogix Profile Config",
      description:
        "Get FSLogix profile container configuration, including VHD location paths, " +
        "size limits, and redirection settings. Use this to verify profile management " +
        "setup, check storage paths, or troubleshoot profile loading issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/fslogix/profile-container");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve FSLogix config") }], isError: true };
      }
    }
  );

  // ── Load Balancing ──────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_load_balancing",
    {
      title: "Load Balancing",
      description:
        "Get load balancing settings, including balancing method, resource weights, " +
        "and session limits. Use this to review how sessions are distributed across " +
        "RDS hosts or diagnose uneven load distribution.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/load-balancing");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve load balancing settings") }], isError: true };
      }
    }
  );

  // ── MFA ─────────────────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_mfa",
    {
      title: "MFA Configuration",
      description:
        "Get multi-factor authentication provider configuration, including enabled " +
        "MFA providers (TOTP, RADIUS, Deepnet, SafeNet, Email OTP), criteria rules, " +
        "and bypass conditions. Use this to audit MFA security posture or troubleshoot " +
        "MFA login failures.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/mfa");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve MFA config") }], isError: true };
      }
    }
  );

  // ── Printing ────────────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_printing",
    {
      title: "Printing Settings",
      description:
        "Get printing configuration settings, including printer redirection, universal " +
        "printing options, and driver policies. Use this to troubleshoot print redirection " +
        "issues or review printing policy configuration.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/printing");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve printing settings") }], isError: true };
      }
    }
  );

  // ── Tenant Broker ───────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_tenant_broker",
    {
      title: "Tenant Broker Status",
      description:
        "Get tenant broker status and join information. The tenant broker enables " +
        "multi-tenant RAS deployments. Use this to verify tenant broker connectivity " +
        "or check join status for managed sites.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/tenant-broker/status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve tenant broker status") }], isError: true };
      }
    }
  );

  // ── Notifications ───────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_notifications",
    {
      title: "Notification Events",
      description:
        "Get notification event configuration, including alert triggers, email " +
        "notifications, and event thresholds. Use this to review which events " +
        "trigger admin notifications or verify alerting is properly configured.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/notifications/events");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve notification events") }], isError: true };
      }
    }
  );

  // ── URL Redirection ─────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_url_redirection",
    {
      title: "URL Redirection",
      description:
        "Get URL redirection rules configured for the site. URL redirection allows " +
        "specific URLs opened on RDS hosts to be redirected to the client device " +
        "browser. Use this to review redirection rules or troubleshoot URL handling.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/url-redirection");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve URL redirection") }], isError: true };
      }
    }
  );

  // ── CPU Optimization ────────────────────────────────────────────────
  server.registerTool(
    "ras_site_get_cpu_optimization",
    {
      title: "CPU Optimization",
      description:
        "Get CPU optimization settings for the site. Controls how CPU resources " +
        "are allocated across user sessions. Use this to review resource management " +
        "policies or troubleshoot performance issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/site-settings/cpu-optimization");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve CPU optimization settings") }], isError: true };
      }
    }
  );
}
