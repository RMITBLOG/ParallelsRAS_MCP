/**
 * Site settings tools for the Parallels RAS MCP Server.
 * Read-only access to AD integration, connection settings, load balancing,
 * MFA, printing, notifications, URL redirection, and tenant broker.
 *
 * Note: FSLogix has no site-level REST endpoint — it is exposed only at
 * per-host-pool / per-AVD-template scope. PowerShell cmdlets are the
 * canonical site-wide interface. A scoped tool can be added later if required.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool, registerObjectTool, type ToolDef } from "./_format.js";

const LIST_TOOLS: ToolDef[] = [
  {
    name: "ras_site_get_notifications",
    title: "Notification Events",
    description:
      "Notification event configuration — alert triggers, email " +
      "notifications, event thresholds. Use this to review which events " +
      "trigger admin notifications or verify alerting is configured.",
    path: "/api/Notifications/Events",
    errorContext: "Failed to retrieve notification events",
  },
  {
    name: "ras_site_get_url_redirection",
    title: "URL Redirection",
    description:
      "URL redirection rules configured for the site. URL redirection allows " +
      "specific URLs opened on RDS hosts to be redirected to the client " +
      "device browser. Use this to review redirection rules or troubleshoot " +
      "URL handling.",
    path: "/api/URLRedirectionSettings",
    errorContext: "Failed to retrieve URL redirection",
  },
];

const OBJECT_TOOLS: ToolDef[] = [
  {
    name: "ras_site_get_ad_integration",
    title: "AD Integration",
    description:
      "Active Directory integration configuration — domain settings, forest " +
      "trust relationships, OU mappings. Use this to verify AD connectivity, " +
      "check domain join status, or troubleshoot authentication issues.",
    path: "/api/ADIntegrationSettings",
    errorContext: "Failed to retrieve AD integration",
  },
  {
    name: "ras_site_get_connection_settings",
    title: "Connection Settings",
    description:
      "Connection and authentication settings — session timeouts, client " +
      "connection policies, authentication methods. Use this to review " +
      "security posture or troubleshoot client connection issues.",
    path: "/api/ConnectionSettings",
    errorContext: "Failed to retrieve connection settings",
  },
  {
    name: "ras_site_get_load_balancing",
    title: "Load Balancing",
    description:
      "Load balancing settings — balancing method, resource weights, session " +
      "limits. Use this to review how sessions are distributed across RDS " +
      "hosts or diagnose uneven load distribution.",
    path: "/api/LBSettings",
    errorContext: "Failed to retrieve load balancing settings",
  },
  {
    name: "ras_site_get_mfa",
    title: "MFA Configuration",
    description:
      "Multi-factor authentication provider configuration — enabled MFA " +
      "providers (TOTP, RADIUS, Deepnet, SafeNet, Email OTP), criteria " +
      "rules, bypass conditions. Use this to audit MFA security posture or " +
      "troubleshoot MFA login failures.",
    path: "/api/MFA",
    errorContext: "Failed to retrieve MFA config",
  },
  {
    name: "ras_site_get_printing",
    title: "Printing Settings",
    description:
      "Printing configuration — printer redirection, universal printing " +
      "options, driver policies. Use this to troubleshoot print redirection " +
      "issues or review printing policy configuration.",
    path: "/api/PrintingSettings",
    errorContext: "Failed to retrieve printing settings",
  },
  {
    name: "ras_site_get_tenant_broker",
    title: "Tenant Broker Status",
    description:
      "Tenant broker status and join information. The tenant broker enables " +
      "multi-tenant RAS deployments. Use this to verify tenant broker " +
      "connectivity or check join status for managed sites.",
    path: "/api/TenantBroker/Status",
    errorContext: "Failed to retrieve tenant broker status",
  },
  {
    name: "ras_site_get_cpu_optimization",
    title: "CPU Optimization",
    description:
      "CPU optimization settings for the site. Controls how CPU resources " +
      "are allocated across user sessions. Use this to review resource " +
      "management policies or troubleshoot performance issues.",
    path: "/api/CPUOptimizationSettings",
    errorContext: "Failed to retrieve CPU optimization settings",
  },
];

export function register(server: McpServer): void {
  for (const def of LIST_TOOLS) registerListTool(server, def);
  for (const def of OBJECT_TOOLS) registerObjectTool(server, def);
}
