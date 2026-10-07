# Parallels RAS MCP Server

A community-maintained [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for Parallels Remote Application Server (RAS) via the [RAS REST API](https://docs.parallels.com/landing/ras-rest-api-guide). Queries are read-only by default. Administrators can opt in to write support.

Gives AI assistants visibility into your RAS infrastructure, site settings, policies, publishing, and sessions. Use it as an MCP server or import the standalone skill for a local agent.

> Not affiliated with Parallels International GmbH. "Parallels" is a trademark of its respective owner.

## Scope and intended use

Two transports are supported, selected via the `MCP_TRANSPORT` environment variable:

- **`stdio`** (default): Launched as a local subprocess by the MCP client (Claude Desktop, Claude Code, Cursor, etc.). Intended for an individual administrator on their own workstation, or for development and test environments. Credentials come from the launching process's environment; there is no network listener.
- **`http`**: A streamable HTTP listener with a required bearer token. Intended for trusted network deployments where one server is shared by multiple clients (e.g. behind a reverse proxy that adds TLS). Defaults to binding `127.0.0.1:3000`; binding to all interfaces is opt-in.

In either mode this server holds a RAS administrator session and exposes 41 read-only RAS tools plus two documentation tools. The standalone skill queries the same 41 RAS endpoints directly and does not expose the documentation tools. Setting `RAS_ENABLE_WRITE=true` also exposes a write-operation discovery tool and one request tool in both options. This enables potentially destructive changes, including session actions and configuration changes. There is no multi-tenancy or per-client rate limiting. Treat access as admin-equivalent and protect it accordingly.

**API compatibility:** the read-only paths were verified against the **Parallels RAS v21** REST API. The opt-in write catalog comes from the official [v21.2 REST API guide](https://download.parallels.com/ras/v21/en_US/Parallels-RAS-REST-API-Guide-21.pdf). Parallels lists REST API 21.2.1.1 as the latest v21 patch in its [release notes](https://kb.parallels.com/en/131037). Check the endpoint documentation and your farm version before writing; this project has not run live write tests against a RAS farm.

**Current source version:** v1.3.0 adds the portable direct-API skill and MCP security hardening. See [History](#history) and [CHANGELOG.md](CHANGELOG.md) for details.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.14.1 or later
- Access to a Parallels RAS server with the REST API enabled (port 20443 by default)
- npm, only when building the MCP server or skill from source

## Install the MCP server from source

```bash
git clone https://github.com/RMITBLOG/ParallelsRAS_MCP.git
cd ParallelsRAS_MCP
npm install
npm run build
```

## Environment Variables

### Connection to RAS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAS_HOST` | Yes | - | RAS server hostname or IP address |
| `RAS_USERNAME` | Yes | - | Administrator username |
| `RAS_PASSWORD` | Yes | - | Administrator password |
| `RAS_PORT` | No | `20443` | REST API port |
| `RAS_IGNORE_TLS` | No | `true` | Skip TLS certificate verification for self-signed RAS deployments. See the security tradeoff below. |
| `NODE_EXTRA_CA_CERTS` | No | - | PEM bundle containing the private CA that issued the RAS certificate. Set this when using `RAS_IGNORE_TLS=false`. |
| `RAS_ENABLE_WRITE` | No | `false` | Register the two write tools in the MCP server and standalone skill. This grants access to documented POST, PUT, and DELETE operations using the configured administrator account. |

### Transport

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `MCP_HTTP_BEARER_TOKEN` | HTTP only | - | Bearer token clients must present in `Authorization: Bearer <token>`. Server refuses to start without it. Generate with `openssl rand -hex 32`. |
| `MCP_HTTP_HOST` | No | `127.0.0.1` | Bind address. Set to `0.0.0.0` to expose on all interfaces (front with TLS termination). |
| `MCP_HTTP_PORT` | No | `3000` | Listen port. |

### Self-signed RAS certificates

`RAS_IGNORE_TLS=true` remains the default for compatibility with RAS deployments
that use a self-signed certificate. This is an explicit security tradeoff: Node's
`NODE_TLS_REJECT_UNAUTHORIZED=0` setting is process-wide, so it disables certificate
verification for both the RAS API connection and the Parallels documentation HTTPS
connection. An attacker able to intercept internal network traffic could impersonate
either service and obtain RAS administrator credentials or session tokens. The server
prints a warning whenever this mode is active. With writes enabled, interception can
also alter administrator requests and responses. Prefer certificate verification
for write-capable deployments.

This setting concerns verification of the remote HTTPS server certificate. It is
unrelated to signing a locally built copy of this MCP server.

For a secure self-signed or private-CA deployment, export the issuing CA certificate
as PEM, ensure the certificate's Subject Alternative Name matches `RAS_HOST`, and
start Node with verification enabled:

```json
{
  "env": {
    "RAS_HOST": "ras-server.example.com",
    "RAS_IGNORE_TLS": "false",
    "NODE_EXTRA_CA_CERTS": "C:\\certificates\\ras-ca.pem"
  }
}
```

`NODE_EXTRA_CA_CERTS` is read when Node starts. Do not place the RAS private key in
this file; it should contain only the public CA certificate chain.

## Configuration

The examples below cover the **stdio** transport, which is the default and what most users want. For the **HTTP** transport, see [Running over HTTP](#running-over-http) further down.

### Skill option for local agents

The repository also includes an importable [Parallels RAS skill](.agents/skills/parallels-ras/SKILL.md) and a [Claude Code project entry point](.claude/skills/parallels-ras/SKILL.md). Its bundled JavaScript runner queries the same 41 read-only RAS endpoints directly and supports opt-in writes. The skill requires Node.js 18.14.1 or later and the same `RAS_*` environment variables, but needs no npm install, source checkout, MCP server, or MCP client configuration. The two documentation tools remain available through the MCP server.

Download [the standalone skill ZIP](skill-packages/parallels-ras-skill.zip) and extract its single `parallels-ras/` folder into `~/.claude/skills/` for Claude Code or `~/.codex/skills/` for Codex. The resulting path should be `~/.claude/skills/parallels-ras/SKILL.md` or `~/.codex/skills/parallels-ras/SKILL.md`. Set `RAS_HOST`, `RAS_USERNAME`, and `RAS_PASSWORD` in the local agent's environment; the agent must be able to reach the RAS API. From source, regenerate the folder and ZIP with `npm install` followed by `npm run package:skill`.

When working in this repository, invoke `$parallels-ras` in Codex or `/parallels-ras` in Claude Code, or ask the agent to inspect the RAS farm. For a direct local check:

```bash
node .agents/skills/parallels-ras/scripts/ras-query.mjs list
node .agents/skills/parallels-ras/scripts/ras-query.mjs call ras_farm_get_version
```

For writes through the skill, set `RAS_ENABLE_WRITE=true`, use `ras_write_operations` to find a documented method and path, and pass the `ras_write_request` JSON on standard input with `node <skill-directory>/scripts/ras-query.mjs call ras_write_request -`. Keep passwords and certificate material out of command arguments and committed files.

The existing stdio and HTTP MCP configurations below remain available when your client supports MCP tool connections.

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

In Cursor settings, go to **Features > MCP Servers** and add:

- **Name:** `parallels-ras`
- **Command:** `node /path/to/ParallelsRAS_MCP/build/index.js`
- **Environment:** `RAS_HOST`, `RAS_USERNAME`, `RAS_PASSWORD`

### Other MCP-compatible clients

For any client supporting MCP over stdio, point it at:

```
node /path/to/ParallelsRAS_MCP/build/index.js
```

with the required environment variables set in the client's MCP server configuration.

## Running over HTTP

The HTTP transport implements [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/) and runs as a long-lived process. Use it when you want one server shared by multiple clients on a trusted network, typically behind a reverse proxy that terminates TLS.

### Start the server

```bash
export RAS_HOST=ras-server.example.com
export RAS_USERNAME=administrator
export RAS_PASSWORD=your-password
export MCP_TRANSPORT=http
export MCP_HTTP_BEARER_TOKEN=$(openssl rand -hex 32)   # required
# export MCP_HTTP_HOST=127.0.0.1                       # default; set 0.0.0.0 to expose
# export MCP_HTTP_PORT=3000

npm run start:http
```

The server logs the listen address on startup. The MCP endpoint is `POST /mcp`. Requests must include `Authorization: Bearer <MCP_HTTP_BEARER_TOKEN>`; missing or wrong tokens return `401`.

HTTP mode accepts request bodies up to 1 MiB, JSON-RPC batches of up to 25 items,
and 16 concurrent authenticated requests by default. With `RAS_ENABLE_WRITE=true`,
the body ceiling is 12 MiB and the concurrency ceiling is four to accommodate
bounded file uploads. Requests beyond these bounds receive `413` or `503`
responses. Each stateless request receives a fresh MCP server and transport context.

### Connect a client

For clients that support a streamable-HTTP MCP server, point them at `http://<host>:<port>/mcp` with the bearer token in the `Authorization` header. For example, the Claude Code CLI:

```bash
claude mcp add parallels-ras --transport http \
  --header "Authorization: Bearer $MCP_HTTP_BEARER_TOKEN" \
  http://your-server:3000/mcp
```

### Production checklist

- **Always** front this with TLS through a reverse proxy (nginx, Caddy, Traefik) that terminates HTTPS. Bind the MCP server to `127.0.0.1` and reach it only through the proxy.
- Treat `MCP_HTTP_BEARER_TOKEN` as a credential with at least 32 bytes of entropy. Store it in a secret manager and rotate it when staff leave.
- Restrict network reachability (firewall, VPN, private subnet). The bearer check is the only auth layer in the server itself.
- The RAS admin credentials sit on the same host as the listener. Anyone with shell access on that host can read them. Do not run this on a multi-tenant box.
- If writes are enabled, anyone holding the HTTP bearer token can attempt every documented write operation permitted to the configured RAS administrator. Use a RAS account with only the permissions needed for the deployment. MCP clients may apply their own approval prompts; the server's write gate is the `RAS_ENABLE_WRITE` configuration setting.
- HTTP clients share one RAS administrator session. Coordinate staged changes and `Settings/apply` calls because an apply operation can activate changes staged by another client.

## Available read tools (41 RAS tools + 2 documentation tools)

These tools are read-only and annotated with `readOnlyHint: true` for automatic approval in compatible clients.

**List tools** (sessions, hosts, certs, agents, published items, etc.) accept three optional inputs for narrowing large responses:

- `fields: string[]`: Keep only these top-level keys on each row.
- `filter: Record<string, string|number|boolean>`: Match top-level fields by equality (AND across keys; strings are case-insensitive).
- `limit: number`: Cap rows after filtering. Default 50, hard max 200.

Responses lead with a one-line `NOTE:` header summarising total rows, filter matches, and truncation. A 64 KB byte safety net applies to every response.

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

> FSLogix is not exposed at site scope by the REST API. It is configured per host pool, per AVD template, or via PowerShell.

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

## Optional write support

Set `RAS_ENABLE_WRITE=true` in the MCP server or standalone skill environment to expose two additional tools. When unset, no write tool is registered or listed. The setting grants configuration-level access; the server does not implement a separate per-action confirmation step.

| Tool | Description |
|------|-------------|
| `ras_write_operations` | Search the v21.2 catalog of 813 documented POST, PUT, and DELETE method/path pairs. Accepts `search`, `limit`, and `offset`. |
| `ras_write_request` | Send one catalog-matched write request. Accepts `method`, `path`, optional query pairs, a JSON body, multipart fields and base64 files, or a raw base64 body with a media type. |

The client's own session logon and logoff endpoints are handled internally and are not exposed as write operations. `ras_write_request` rejects paths outside the documented catalog, paths outside `/api/`, redirects, mixed body formats, and bodies larger than 8 MiB. It does not retry a write after an error or timeout. Response output remains capped at 64 KiB. A successful request may still need a separate documented `POST /api/Settings/apply` operation before the change becomes active. Check the relevant endpoint in the [official API guide](https://download.parallels.com/ras/v21/en_US/Parallels-RAS-REST-API-Guide-21.pdf) for required fields and the apply workflow. File uploads and responses were tested with mocks, not a live farm.

## Extending

Most tools follow one of two shapes: a **list tool** (the API returns an array of rows) or a **single-object tool** (config/status blob). Both are registered through factories in `src/tools/_format.ts`, so adding a new tool is a small `ToolDef` record plus one factory call.

To add a new tool:

1. Open the appropriate file in `src/tools/` (e.g., `infrastructure.ts` for a new infra resource), or create a new one.
2. Add a `ToolDef` record to the file's `LIST_TOOLS` or `OBJECT_TOOLS` array:

   ```ts
   {
     name: "ras_infra_get_widgets",
     title: "Widgets",
     description: "List widgets in the farm. Supports `fields`, `filter`, `limit`.",
     path: "/api/Widget",
     errorContext: "Failed to retrieve widgets",
   }
   ```
3. If you created a new file, export a `register(server)` function that loops over your `ToolDef` arrays calling `registerListTool` and/or `registerObjectTool`, then import and call it from `src/index.ts`.
4. Check the new `path:` against the v21 REST API reference, then run `npm run build` and `npm test`. The current build compiles TypeScript; it does not automatically verify new API paths against the OpenAPI spec.

`registerListTool` automatically wires the `fields` / `filter` / `limit` schema and routes the response through `formatList`. `registerObjectTool` skips the schema but still applies the 64 KB byte safety net.

Module file names (`infrastructure.ts`, `site-settings.ts`, etc.) group related tools internally. They do **not** correspond to URL segments. The real RAS API is flat under `/api/<PascalCaseResource>` (e.g. `/api/Agent`, `/api/License`, `/api/MFA`).

### API reference

- Browser reference: <https://docs.parallels.com/landing/ras-rest-api-guide>
- API base URL: `https://<ras-host>:20443/api/`

## Roadmap

- **OAuth / OIDC for the HTTP transport:** The server currently uses a single shared bearer token. Per-user identity would let multiple clients share a deployment without sharing credentials.

## Contributing

Issues and pull requests are welcome. Please open an issue first for anything beyond a small fix so we can agree on the approach.

## History

See [CHANGELOG.md](CHANGELOG.md) for the full release log. Recent highlights:

- **v1.3.0:** Portable standalone skill ZIP for Claude Code and Codex, plus hardened RAS requests, HTTP request limits, output handling, and secret redaction. The self-signed certificate compatibility default remains documented.
- **v1.2.0:** Efficiency pass across all 41 tools: `fields` / `filter` / `limit` inputs on every list tool, default row cap of 50, 64 KB byte safety net on every response, shared registration factories. Backward-compatible at the MCP protocol level.
- **v1.1.0:** Opt-in streamable HTTP transport with bearer-token auth, alongside the existing stdio transport.
- **v1.0.1:** Corrects all 41 tool paths against the Parallels RAS v21 REST API and adds a build-time path verifier.

## License

[MIT](LICENSE)
