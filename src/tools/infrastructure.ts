/**
 * Infrastructure tools for the Parallels RAS MCP Server.
 * Provides read-only access to agents, brokers, providers, hosts, gateways,
 * sites, certificates, HALB devices, enrollment servers, SAML, themes, and VDI.
 * @author Ryan Mangan
 * @created 2026-02-10
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rasClient, sanitiseError } from "../client.js";

/** Shared annotations for all read-only infrastructure tools. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function register(server: McpServer): void {
  // ── Agents ──────────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_agents",
    {
      title: "RAS Agents",
      description:
        "List all Parallels RAS agents deployed across the farm, including their " +
        "hostname, IP, OS, agent version, and current status. Use this to verify " +
        "agent deployment, diagnose connectivity issues, or check agent versions.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Agent");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve agents") }], isError: true };
      }
    }
  );

  // ── Connection Brokers ──────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_connection_brokers",
    {
      title: "Connection Brokers",
      description:
        "Get connection broker status, priority, and configuration. Connection brokers " +
        "handle user session brokering and load distribution. Use this to check broker " +
        "health, verify primary/secondary priority, or diagnose session routing issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Broker");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve connection brokers") }], isError: true };
      }
    }
  );

  // ── Providers ───────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_providers",
    {
      title: "Providers",
      description:
        "List all cloud and hypervisor providers configured in the RAS farm, including " +
        "AVD, AWS EC2, Azure, Hyper-V, Nutanix, vCenter, and VMware ESXi. Use this to " +
        "verify provider connectivity, check provider types, or audit multi-cloud config.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Provider");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve providers") }], isError: true };
      }
    }
  );

  // ── RDS Hosts ───────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_rds_hosts",
    {
      title: "RDS Hosts",
      description:
        "List RDS (Remote Desktop Services) session hosts and their details including " +
        "hostname, IP, agent status, active sessions, CPU/RAM usage, and OS version. " +
        "Use this to monitor host health, check capacity, or troubleshoot RDS issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/RDS/Host");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve RDS hosts") }], isError: true };
      }
    }
  );

  // ── RDS Host Pools ──────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_rds_hostpools",
    {
      title: "RDS Host Pools",
      description:
        "List RDS host pool membership and configuration. Host pools group RDS servers " +
        "for load balancing and resource allocation. Use this to review pool composition, " +
        "check host assignments, or verify pool settings.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/RDS/HostPool");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve RDS host pools") }], isError: true };
      }
    }
  );

  // ── Certificates ────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_certificates",
    {
      title: "Certificates",
      description:
        "List the certificate inventory for the RAS farm, including certificate names, " +
        "expiration dates, issuers, and usage. Use this to audit SSL/TLS certificates, " +
        "check for upcoming expirations, or verify certificate assignments.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Certificates");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve certificates") }], isError: true };
      }
    }
  );

  // ── HALB Status ─────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_halb_status",
    {
      title: "HALB Status",
      description:
        "Get the status of HALB (High Availability Load Balancer) devices in the farm. " +
        "Returns device health, IP addresses, and operational state. Use this to monitor " +
        "load balancer availability or diagnose gateway connectivity issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/HALB/status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve HALB status") }], isError: true };
      }
    }
  );

  // ── Enrollment Server Status ────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_enrollment_status",
    {
      title: "Enrollment Servers",
      description:
        "Get enrollment server status. Enrollment servers handle SCEP certificate " +
        "enrollment for device management. Use this to check enrollment server health " +
        "or troubleshoot certificate enrollment failures.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/EnrollmentServer/Status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve enrollment server status") }], isError: true };
      }
    }
  );

  // ── VDI Host Pools ──────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_vdi_hostpools",
    {
      title: "VDI Host Pools",
      description:
        "List VDI host pool configuration, including pool members, provisioning settings, " +
        "and capacity. Use this to review VDI pool composition, check desktop provisioning " +
        "status, or verify pool sizing.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/VDI/HostPool");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve VDI host pools") }], isError: true };
      }
    }
  );

  // ── VDI Templates ───────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_vdi_templates",
    {
      title: "VDI Templates",
      description:
        "List VDI templates, their status, and configuration. Templates define the " +
        "base image and settings for provisioned VDI desktops. Use this to check " +
        "template versions, maintenance mode status, or provisioning settings.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/VDI/Template");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve VDI templates") }], isError: true };
      }
    }
  );

  // ── Gateway Status ──────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_gateway_status",
    {
      title: "Gateway Status",
      description:
        "Get the status of RAS Secure Client Gateways, including connection state, " +
        "IP addresses, and tunnel mode. Gateways provide external user access to " +
        "published resources. Use this to monitor gateway health or troubleshoot " +
        "external connectivity issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Gateway/status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve gateway status") }], isError: true };
      }
    }
  );

  // ── Sites ───────────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_sites",
    {
      title: "Sites",
      description:
        "List all sites configured in the RAS farm and their status. Multi-site " +
        "deployments distribute infrastructure across locations. Use this to check " +
        "site connectivity, verify site configuration, or audit the farm topology.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Site/status");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve sites") }], isError: true };
      }
    }
  );

  // ── SAML Identity Providers ─────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_saml_idps",
    {
      title: "SAML Identity Providers",
      description:
        "List SAML identity providers configured for single sign-on (SSO). Returns " +
        "provider names, metadata URLs, and configuration details. Use this to audit " +
        "SSO configuration or troubleshoot SAML authentication issues.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/SAMLIDP");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve SAML identity providers") }], isError: true };
      }
    }
  );

  // ── Themes ──────────────────────────────────────────────────────────
  server.registerTool(
    "ras_infra_get_themes",
    {
      title: "Themes",
      description:
        "List user portal themes configured in the RAS farm, including branding, " +
        "logos, and customisation settings. Use this to review portal appearance " +
        "configuration or verify theme assignments.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await rasClient.get("/api/Theme");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: sanitiseError(err, "Failed to retrieve themes") }], isError: true };
      }
    }
  );
}
