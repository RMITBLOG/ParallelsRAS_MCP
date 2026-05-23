/**
 * Publishing tools for the Parallels RAS MCP Server.
 * Read-only access to published applications, desktops, folders, and
 * publishing status across RDS, VDI, and AVD resource types.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool, registerObjectTool, type ToolDef } from "./_format.js";

const LIST_TOOLS: ToolDef[] = [
  {
    name: "ras_pub_get_rds_apps",
    title: "Published RDS Apps",
    description:
      "List published RDS applications — app names, executable paths, server " +
      "associations, user filter assignments. Use this to review which apps " +
      "are published via RDS, check app configurations, or troubleshoot launch " +
      "issues.",
    path: "/api/PubItems/Apps/RDS",
    errorContext: "Failed to retrieve published RDS apps",
  },
  {
    name: "ras_pub_get_vdi_apps",
    title: "Published VDI Apps",
    description:
      "List published VDI applications. VDI apps run on dedicated virtual " +
      "machines rather than shared RDS hosts. Use this to review VDI-published " +
      "applications or compare with RDS app assignments.",
    path: "/api/PubItems/Apps/VDI",
    errorContext: "Failed to retrieve published VDI apps",
  },
  {
    name: "ras_pub_get_avd_apps",
    title: "Published AVD Apps",
    description:
      "List published Azure Virtual Desktop applications. AVD apps are " +
      "delivered from Azure-hosted session hosts. Use this to review AVD app " +
      "assignments or verify Azure-based application publishing.",
    path: "/api/PubItems/Apps/AVD",
    errorContext: "Failed to retrieve published AVD apps",
  },
  {
    name: "ras_pub_get_rds_desktops",
    title: "Published RDS Desktops",
    description:
      "List published RDS desktop resources. RDS desktops deliver full Windows " +
      "desktops from shared session hosts. Use this to review RDS desktop " +
      "assignments or troubleshoot launch issues.",
    path: "/api/PubItems/Desktops/RDS",
    errorContext: "Failed to retrieve published RDS desktops",
  },
  {
    name: "ras_pub_get_vdi_desktops",
    title: "Published VDI Desktops",
    description:
      "List published VDI desktop resources. VDI desktops deliver dedicated " +
      "virtual machines per user. Use this to review assignments or verify " +
      "per-user desktop allocation.",
    path: "/api/PubItems/Desktops/VDI",
    errorContext: "Failed to retrieve published VDI desktops",
  },
  {
    name: "ras_pub_get_avd_desktops",
    title: "Published AVD Desktops",
    description:
      "List published Azure Virtual Desktop resources. AVD desktops are " +
      "delivered from Azure-hosted session hosts. Use this to review AVD " +
      "desktop assignments or verify Azure-based desktop publishing.",
    path: "/api/PubItems/Desktops/AVD",
    errorContext: "Failed to retrieve published AVD desktops",
  },
  {
    name: "ras_pub_get_folders",
    title: "Publishing Folders",
    description:
      "List published resource folders that organise applications and " +
      "desktops into logical groups for end users. Use this to review folder " +
      "hierarchy, check resource organisation, or verify folder-level access.",
    path: "/api/PubItems/Folders",
    errorContext: "Failed to retrieve publishing folders",
  },
  {
    name: "ras_pub_get_all_items",
    title: "All Published Items",
    description:
      "List all published items across all resource types (RDS, VDI, AVD apps " +
      "and desktops) in a single view. Use this for a complete overview of " +
      "everything published in the farm. Large farms can return thousands of " +
      "items — narrow with `filter` (e.g. {type: 'App'}) or project with " +
      "`fields` to keep responses small.",
    path: "/api/PubItems",
    errorContext: "Failed to retrieve all published items",
  },
];

const OBJECT_TOOLS: ToolDef[] = [
  {
    name: "ras_pub_get_status",
    title: "Publishing Status",
    description:
      "Overall publishing service status and health. Returns whether the " +
      "publishing agent is operational and any pending changes. Use this to " +
      "verify publishing is functioning or diagnose why resources are " +
      "unavailable.",
    path: "/api/PubItems/status",
    errorContext: "Failed to retrieve publishing status",
  },
];

export function register(server: McpServer): void {
  for (const def of LIST_TOOLS) registerListTool(server, def);
  for (const def of OBJECT_TOOLS) registerObjectTool(server, def);
}
