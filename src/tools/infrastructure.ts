/**
 * Infrastructure tools for the Parallels RAS MCP Server.
 * Read-only access to agents, brokers, providers, hosts, gateways, sites,
 * certificates, HALB devices, enrollment servers, SAML, themes, and VDI.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool, type ToolDef } from "./_format.js";

const TOOLS: ToolDef[] = [
  {
    name: "ras_infra_get_agents",
    title: "RAS Agents",
    description:
      "List all Parallels RAS agents deployed across the farm — hostname, IP, " +
      "OS, agent version, and current status. Use this to verify agent " +
      "deployment, diagnose connectivity, or check agent versions. Supports " +
      "`fields`, `filter`, and `limit` to narrow large result sets.",
    path: "/api/Agent",
    errorContext: "Failed to retrieve agents",
  },
  {
    name: "ras_infra_get_connection_brokers",
    title: "Connection Brokers",
    description:
      "Connection broker status, priority, and configuration. Brokers handle " +
      "user session brokering and load distribution. Use this to check broker " +
      "health, verify primary/secondary priority, or diagnose session routing.",
    path: "/api/Broker",
    errorContext: "Failed to retrieve connection brokers",
  },
  {
    name: "ras_infra_get_providers",
    title: "Providers",
    description:
      "List all cloud and hypervisor providers configured in the RAS farm — " +
      "AVD, AWS EC2, Azure, Hyper-V, Nutanix, vCenter, VMware ESXi. Use this " +
      "to verify provider connectivity, check provider types, or audit " +
      "multi-cloud config.",
    path: "/api/Provider",
    errorContext: "Failed to retrieve providers",
  },
  {
    name: "ras_infra_get_rds_hosts",
    title: "RDS Hosts",
    description:
      "List RDS session hosts — hostname, IP, agent status, active sessions, " +
      "CPU/RAM usage, OS version. Use this to monitor host health, check " +
      "capacity, or troubleshoot RDS issues. On large farms, narrow with " +
      "`filter` (e.g. {status: 'online'}) or `fields` to keep responses small.",
    path: "/api/RDS/Host",
    errorContext: "Failed to retrieve RDS hosts",
  },
  {
    name: "ras_infra_get_rds_hostpools",
    title: "RDS Host Pools",
    description:
      "List RDS host pool membership and configuration. Host pools group RDS " +
      "servers for load balancing and resource allocation. Use this to review " +
      "pool composition, check host assignments, or verify pool settings.",
    path: "/api/RDS/HostPool",
    errorContext: "Failed to retrieve RDS host pools",
  },
  {
    name: "ras_infra_get_certificates",
    title: "Certificates",
    description:
      "Certificate inventory for the RAS farm — names, expiration dates, " +
      "issuers, and usage. Use this to audit SSL/TLS certificates, check for " +
      "upcoming expirations, or verify assignments.",
    path: "/api/Certificates",
    errorContext: "Failed to retrieve certificates",
  },
  {
    name: "ras_infra_get_halb_status",
    title: "HALB Status",
    description:
      "Status of HALB (High Availability Load Balancer) devices in the farm — " +
      "device health, IP addresses, operational state. Use this to monitor " +
      "load balancer availability or diagnose gateway connectivity.",
    path: "/api/HALB/status",
    errorContext: "Failed to retrieve HALB status",
  },
  {
    name: "ras_infra_get_enrollment_status",
    title: "Enrollment Servers",
    description:
      "Enrollment server status. Enrollment servers handle SCEP certificate " +
      "enrollment for device management. Use this to check enrollment server " +
      "health or troubleshoot certificate enrollment failures.",
    path: "/api/EnrollmentServer/Status",
    errorContext: "Failed to retrieve enrollment server status",
  },
  {
    name: "ras_infra_get_vdi_hostpools",
    title: "VDI Host Pools",
    description:
      "List VDI host pool configuration — pool members, provisioning " +
      "settings, capacity. Use this to review VDI pool composition, check " +
      "desktop provisioning status, or verify pool sizing.",
    path: "/api/VDI/HostPool",
    errorContext: "Failed to retrieve VDI host pools",
  },
  {
    name: "ras_infra_get_vdi_templates",
    title: "VDI Templates",
    description:
      "List VDI templates, their status, and configuration. Templates define " +
      "the base image and settings for provisioned VDI desktops. Use this to " +
      "check template versions, maintenance mode, or provisioning settings.",
    path: "/api/VDI/Template",
    errorContext: "Failed to retrieve VDI templates",
  },
  {
    name: "ras_infra_get_gateway_status",
    title: "Gateway Status",
    description:
      "Status of RAS Secure Client Gateways — connection state, IP addresses, " +
      "tunnel mode. Gateways provide external user access to published " +
      "resources. Use this to monitor gateway health or troubleshoot external " +
      "connectivity.",
    path: "/api/Gateway/status",
    errorContext: "Failed to retrieve gateway status",
  },
  {
    name: "ras_infra_get_sites",
    title: "Sites",
    description:
      "List all sites configured in the RAS farm and their status. Multi-site " +
      "deployments distribute infrastructure across locations. Use this to " +
      "check site connectivity, verify configuration, or audit farm topology.",
    path: "/api/Site/status",
    errorContext: "Failed to retrieve sites",
  },
  {
    name: "ras_infra_get_saml_idps",
    title: "SAML Identity Providers",
    description:
      "List SAML identity providers configured for SSO — provider names, " +
      "metadata URLs, configuration details. Use this to audit SSO " +
      "configuration or troubleshoot SAML authentication.",
    path: "/api/SAMLIDP",
    errorContext: "Failed to retrieve SAML identity providers",
  },
  {
    name: "ras_infra_get_themes",
    title: "Themes",
    description:
      "List user portal themes configured in the RAS farm — branding, logos, " +
      "customisation settings. Use this to review portal appearance " +
      "configuration or verify theme assignments.",
    path: "/api/Theme",
    errorContext: "Failed to retrieve themes",
  },
];

export function register(server: McpServer): void {
  for (const def of TOOLS) registerListTool(server, def);
}
