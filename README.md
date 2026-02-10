# Parallels RAS MCP Server

A lightweight, read-only [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for querying Parallels Remote Application Server (RAS) infrastructure via the [RAS REST API v20](https://docs.parallels.com/parallels-rest-api-20).

Gives AI assistants read-only visibility into your RAS environment — infrastructure, site settings, policies, publishing, sessions, and support — without making any changes.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm
- Access to a Parallels RAS server with the REST API enabled (port 20443)

## Installation

```bash
git clone https://github.com/RMITBLOG/ParallelsRAS_MCP.git
cd ParallelsRAS_MCP
npm install
npm run build
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAS_HOST` | Yes | — | RAS server hostname or IP address |
| `RAS_USERNAME` | Yes | — | Administrator username |
| `RAS_PASSWORD` | Yes | — | Administrator password |
| `RAS_PORT` | No | `20443` | REST API port |
| `RAS_IGNORE_TLS` | No | `true` | Skip TLS certificate verification (for self-signed certs) |

## Configuration

### Claude Desktop

Edit your `claude_desktop_config.json` (typically at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "parallels-ras": {
      "command": "node",
      "args": ["/path/to/RAS_MCP/build/index.js"],
      "env": {
        "RAS_HOST": "ras-server.example.com",
        "RAS_USERNAME": "administrator",
        "RAS_PASSWORD": "your-password",
        "RAS_PORT": "20443",
        "RAS_IGNORE_TLS": "true"
      }
    }
  }
}
```

### Claude Code

Add the MCP server to your project or global settings:

```bash
claude mcp add parallels-ras -- node /path/to/RAS_MCP/build/index.js
```

Set environment variables in your shell or in the Claude Code MCP configuration.

### Cursor

In Cursor settings, go to **Features > MCP Servers** and add a new server:

- **Name:** `parallels-ras`
- **Command:** `node /path/to/RAS_MCP/build/index.js`
- **Environment Variables:**
  - `RAS_HOST` = `ras-server.example.com`
  - `RAS_USERNAME` = `administrator`
  - `RAS_PASSWORD` = `your-password`

### OpenAI-Compatible Clients

For clients supporting the MCP standard via stdio transport, configure the server command as:

```
node /path/to/RAS_MCP/build/index.js
```

With the required environment variables (`RAS_HOST`, `RAS_USERNAME`, `RAS_PASSWORD`) set in the client's MCP server configuration.

## Available Tools (41 total)

All tools are read-only and annotated with `readOnlyHint: true` for automatic approval in compatible clients.

### Infrastructure (14 tools)

| Tool | Description |
|------|-------------|
| `ras_infra_get_agents` | List all RAS agents and their status |
| `ras_infra_get_connection_brokers` | Connection broker status and priority |
| `ras_infra_get_providers` | Cloud/hypervisor providers (AVD, AWS, Azure, Hyper-V, etc.) |
| `ras_infra_get_rds_hosts` | RDS session hosts |
| `ras_infra_get_rds_hostpools` | RDS host pools |
| `ras_infra_get_certificates` | Certificate inventory |
| `ras_infra_get_halb_status` | HALB device status |
| `ras_infra_get_enrollment_status` | Enrollment server status |
| `ras_infra_get_vdi_hostpools` | VDI host pools |
| `ras_infra_get_vdi_templates` | VDI templates |
| `ras_infra_get_gateway_status` | Secure Client Gateway status |
| `ras_infra_get_sites` | Farm sites and their status |
| `ras_infra_get_saml_idps` | SAML identity providers for SSO |
| `ras_infra_get_themes` | User portal themes and branding |

### Site Settings (10 tools)

| Tool | Description |
|------|-------------|
| `ras_site_get_ad_integration` | Active Directory integration config |
| `ras_site_get_connection_settings` | Connection and authentication settings |
| `ras_site_get_fslogix` | FSLogix profile container config |
| `ras_site_get_load_balancing` | Load balancing settings |
| `ras_site_get_mfa` | MFA provider configuration |
| `ras_site_get_printing` | Printing settings |
| `ras_site_get_tenant_broker` | Tenant broker status |
| `ras_site_get_notifications` | Notification event configuration |
| `ras_site_get_url_redirection` | URL redirection rules |
| `ras_site_get_cpu_optimization` | CPU optimization settings |

### Policies (1 tool)

| Tool | Description |
|------|-------------|
| `ras_policies_list` | List all client policies |

### Farm Settings (7 tools)

| Tool | Description |
|------|-------------|
| `ras_farm_get_administrators` | Admin accounts and roles |
| `ras_farm_get_config` | Farm configuration |
| `ras_farm_get_licensing` | Licensing status and seat usage |
| `ras_farm_get_version` | Web service version |
| `ras_farm_get_performance` | Performance monitor configuration |
| `ras_farm_get_mailbox` | SMTP mailbox settings |
| `ras_farm_get_reporting` | Reporting configuration |

### Publishing (7 tools)

| Tool | Description |
|------|-------------|
| `ras_pub_get_rds_apps` | Published RDS applications |
| `ras_pub_get_vdi_apps` | Published VDI applications |
| `ras_pub_get_avd_apps` | Published AVD applications |
| `ras_pub_get_desktops` | Published desktops |
| `ras_pub_get_folders` | Resource folders |
| `ras_pub_get_status` | Publishing service status |
| `ras_pub_get_all_items` | All published items (combined view) |

### RD Sessions (1 tool)

| Tool | Description |
|------|-------------|
| `ras_sessions_list` | Active remote desktop sessions |

### Help & Support (1 tool)

| Tool | Description |
|------|-------------|
| `ras_support_info` | Support information |

## Extending

To add a new tool module:

1. Create a new file in `src/tools/` (e.g., `notifications.ts`)
2. Export a `register(server: McpServer): void` function
3. Use `rasClient.get("/api/...")` to call RAS endpoints
4. Import and call your `register` function in `src/index.ts`
5. Rebuild: `npm run build`

See existing tool files for the pattern.

## License

MIT
