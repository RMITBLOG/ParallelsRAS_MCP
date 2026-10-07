/**
 * Farm settings tools for the Parallels RAS MCP Server.
 * Read-only access to farm configuration, licensing, admin accounts,
 * performance monitoring, reporting, and mailbox settings.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool, registerObjectTool, type ToolDef } from "./_format.js";

export const LIST_TOOLS: ToolDef[] = [
  {
    name: "ras_farm_get_administrators",
    title: "Farm Administrators",
    description:
      "List RAS farm administrator accounts — usernames, roles, permissions, " +
      "group membership. Use this to audit admin access, verify role " +
      "assignments, or review who has administrative control of the farm.",
    path: "/api/AdminAccount",
    errorContext: "Failed to retrieve administrators",
  },
];

export const OBJECT_TOOLS: ToolDef[] = [
  {
    name: "ras_farm_get_config",
    title: "Farm Configuration",
    description:
      "RAS farm configuration settings — farm name, domain, backup settings, " +
      "global options. Use this to review the overall farm setup, verify " +
      "domain configuration, or check backup scheduling.",
    path: "/api/FarmSettings",
    errorContext: "Failed to retrieve farm config",
  },
  {
    name: "ras_farm_get_licensing",
    title: "Licensing",
    description:
      "RAS licensing status — license type (subscription/perpetual), " +
      "expiration date, seat count, usage, activation status. Use this to " +
      "check compliance, verify capacity, or diagnose licensing issues.",
    path: "/api/License",
    errorContext: "Failed to retrieve licensing info",
  },
  {
    name: "ras_farm_get_version",
    title: "Web Service Version",
    description:
      "RAS web service (REST API) version information. Returns the current " +
      "API version and build number. Use this to verify the API version is " +
      "compatible or check which features are available.",
    path: "/api/WebService/version",
    errorContext: "Failed to retrieve version info",
  },
  {
    name: "ras_farm_get_performance",
    title: "Performance Monitor",
    description:
      "Performance monitor configuration and counters for the RAS farm — " +
      "resource utilisation thresholds and monitoring settings. Use this to " +
      "review performance baselines or check monitoring configuration.",
    path: "/api/PerformanceMonitor",
    errorContext: "Failed to retrieve performance monitor",
  },
  {
    name: "ras_farm_get_mailbox",
    title: "Mailbox Settings",
    description:
      "SMTP mailbox configuration used for RAS email notifications — server " +
      "address, port, sender details. Use this to verify email notification " +
      "settings or troubleshoot delivery failures.",
    path: "/api/MailboxSettings",
    errorContext: "Failed to retrieve mailbox settings",
  },
  {
    name: "ras_farm_get_reporting",
    title: "Reporting",
    description:
      "Reporting configuration for the RAS farm — report scheduling, data " +
      "retention, database connection. Use this to verify reporting is " +
      "enabled and properly configured.",
    path: "/api/Reporting",
    errorContext: "Failed to retrieve reporting config",
  },
];

export function register(server: McpServer): void {
  for (const def of LIST_TOOLS) registerListTool(server, def);
  for (const def of OBJECT_TOOLS) registerObjectTool(server, def);
}
