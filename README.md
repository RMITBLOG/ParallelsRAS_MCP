# Parallels RAS MCP Server

A community-maintained, read-only [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for querying Parallels Remote Application Server (RAS) infrastructure via the [RAS REST API](https://docs.parallels.com/landing/ras-rest-api-guide).

Gives AI assistants visibility into your RAS environment — infrastructure, site settings, policies, publishing, and sessions — without making any changes.

> Not affiliated with Parallels International GmbH. "Parallels" is a trademark of its respective owner.

## Scope and intended use

This server uses the MCP **stdio transport**, which means it runs as a local subprocess of the MCP client (Claude Desktop, Claude Code, Cursor, etc.) on the same machine. It is intended for:

- **Local use** by an individual administrator on their own workstation, against a RAS environment they already have credentials for.
- **Development and test** environments, or read-only inspection of a production farm from a trusted admin workstation.

It is **not** intended to be exposed as a network service or shared between users. Credentials are read from the local environment of the launching process; there is no auth layer, multi-tenancy, or rate limiting. If you need a remote/shared deployment, an HTTP-transport variant would need to be built on top (see *Roadmap* below).

**API compatibility:** verified against the **Parallels RAS v21** REST API. Resources used are stable across v18–v21.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm
- Access to a Parallels RAS server with the REST API enabled (port 20443 by default)

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
      "args": ["/path/to/ParallelsRAS_MCP/build/index.js"],
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

```bash
claude mcp add parallels-ras -- node /path/to/ParallelsRAS_MCP/build/index.js
```

Set environment variables in your shell or in the Claude Code MCP configuration.

### Cursor

In Cursor settings, go to **Features → MCP Servers** and add:

- **Name:** `parallels-ras`
- **Command:** `node /path/to/ParallelsRAS_MCP/build/index.js`
- **Environment:** `RAS_HOST`, `RAS_USERNAME`, `RAS_PASSWORD`

### Other MCP-compatible clients

For any client supporting MCP over stdio, point it at:

```
node /path/to/ParallelsRAS_MCP/build/index.js
```

with the required environment variables set in the client's MCP server configuration.

## Available Tools (41 total)

All tools are read-only and annotated with `readOnlyHint: true` for automatic approval in compatible clients.

### Infrastructure (14)

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

### Site Settings (9)

| Tool | Description |
|------|-------------|
| `ras_site_get_ad_integration` | Active Directory integration config |
| `ras_site_get_connection_settings` | Connection and authentication settings |
| `ras_site_get_load_balancing` | Load balancing settings |
| `ras_site_get_mfa` | MFA provider configuration |
| `ras_site_get_printing` | Printing settings |
| `ras_site_get_tenant_broker` | Tenant broker status |
| `ras_site_get_notifications` | Notification event configuration |
| `ras_site_get_url_redirection` | URL redirection rules |
| `ras_site_get_cpu_optimization` | CPU optimization settings |

> FSLogix is not exposed at site scope by the REST API — it is configured per host pool / per AVD template, or via PowerShell.

### Policies (1)

| Tool | Description |
|------|-------------|
| `ras_policies_list` | List all client policies |

### Farm Settings (7)

| Tool | Description |
|------|-------------|
| `ras_farm_get_administrators` | Admin accounts and roles |
| `ras_farm_get_config` | Farm configuration |
| `ras_farm_get_licensing` | Licensing status and seat usage |
| `ras_farm_get_version` | Web service version |
| `ras_farm_get_performance` | Performance monitor configuration |
| `ras_farm_get_mailbox` | SMTP mailbox settings |
| `ras_farm_get_reporting` | Reporting configuration |

### Publishing (9)

| Tool | Description |
|------|-------------|
| `ras_pub_get_rds_apps` | Published RDS applications |
| `ras_pub_get_vdi_apps` | Published VDI applications |
| `ras_pub_get_avd_apps` | Published AVD applications |
| `ras_pub_get_rds_desktops` | Published RDS desktops |
| `ras_pub_get_vdi_desktops` | Published VDI desktops |
| `ras_pub_get_avd_desktops` | Published AVD desktops |
| `ras_pub_get_folders` | Resource folders |
| `ras_pub_get_status` | Publishing service status |
| `ras_pub_get_all_items` | All published items (combined view) |

### RD Sessions (1)

| Tool | Description |
|------|-------------|
| `ras_sessions_list` | Active remote desktop sessions |

## Extending

To add a new tool:

1. Create or open a file in `src/tools/` (e.g., `notifications.ts`).
2. Export a `register(server: McpServer): void` function.
3. Call `rasClient.get("/api/<Resource>")` with a path that exists in the official RAS REST API.
4. Import and call your `register` function in `src/index.ts`.
5. Run `npm run build`.

Module file names (`infrastructure.ts`, `site-settings.ts`, etc.) are an internal grouping for related tools. They do **not** correspond to URL segments — the real RAS API is flat under `/api/<PascalCaseResource>` (e.g. `/api/Agent`, `/api/License`, `/api/MFA`).

### API reference

- Browser reference: <https://docs.parallels.com/landing/ras-rest-api-guide>
- API base URL: `https://<ras-host>:20443/api/`

## Roadmap

- **HTTP / streamable-HTTP transport** — would enable remote or shared deployments (single MCP server, multiple clients, proper auth in front). The stdio model in this repo is deliberately local-only; an HTTP variant is a separate piece of work.
- **Write operations** — out of scope for this repo. A separate server should host any tool that mutates RAS state, so read-only tools can stay safe to auto-approve.

## Contributing

Issues and pull requests are welcome. Please open an issue first for anything beyond a small fix so we can agree on the approach.

## History

The initial v1.0.0 release was a draft scaffold whose REST API paths had been modelled from the documentation table-of-contents headings rather than the real endpoints. v1.0.1 corrects all 41 tool paths against the Parallels RAS v21 REST API and adds a build-time path verifier (`scripts/verify-tool-paths.mjs`) against the bundled OpenAPI spec.

## License

[MIT](LICENSE)
