# Changelog

All notable changes to the Parallels RAS MCP Server are documented here.
Format adapted from [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Add a repository-local Parallels RAS skill and command runner for agents with
  shell access. It calls the shared RAS API client directly, without an MCP
  server process or client configuration, and has a Claude Code skill entry.

### Security

- Reject automatic redirects on all credential-bearing RAS requests.
- Create a fresh stateless MCP server and HTTP transport for every request.
- Limit HTTP bodies to 1 MiB, JSON-RPC batches to 25 items, and concurrent
  authenticated requests to 16; configure explicit server timeouts.
- Coalesce concurrent RAS login and token-refresh requests into one operation.
- Bound upstream response buffering and enforce the 64 KiB output ceiling in
  encoded UTF-8 bytes, including documentation responses.
- Restrict `ras_docs_get_page` to exact `https://docs.parallels.com` URLs.
- Remove upstream response bodies from caller-visible errors and expand secret
  redaction coverage.
- Upgrade `@modelcontextprotocol/sdk` to 1.32.1 and patched transitive packages;
  retain Node 18 compatibility by pinning `@hono/node-server` 1.19.17.

### Documentation

- Document the accepted compatibility risk of the default self-signed TLS mode
  and the preferred `NODE_EXTRA_CA_CERTS` configuration.

## [1.2.0] — 2026-05-23

Efficiency pass across all 41 read-only RAS tools, motivated by the observation
that flat list dumps and 1:1 API mirrors push too much raw data into the
model's context on every call. All changes are backward-compatible at the MCP
protocol level — every new input is optional, no tools were removed or
renamed, and all 41 paths still verify against the v21 OpenAPI spec.

### Added

- **`fields` input on every list tool** — top-level key projection. Callers
  request only the columns they need; unknown keys are silently dropped.
  Example: `ras_infra_get_rds_hosts({ fields: ["hostname","status","activeSessions"] })`.
- **`filter` input on every list tool** — equality filter on top-level
  fields, AND across keys. String values match case-insensitively (RAS API
  casing varies between resources). Example:
  `ras_sessions_list({ filter: { state: "Active", user: "jdoe" } })`.
- **`limit` input on every list tool** — caps rows after filtering. Default
  50, hard maximum 200.
- **Default row cap of 50 on every list response** — protects the model's
  context window on large farms. When the cap is hit, the response leads
  with a hint, e.g.
  `NOTE: 487 rows total; showing first 50; narrow with filter or raise limit (max 200).`
- **64 KB byte safety net on every tool response** (list and single-object
  endpoints). If a payload exceeds this it is truncated with a hint to
  project with `fields`.
- **`src/tools/_format.ts`** — new shared module owning the schema
  (`LIST_INPUT_SCHEMA`), shaping helper (`formatList`), and registration
  factories (`registerListTool` / `registerObjectTool`).

### Changed

- **All 7 tool files refactored** to declare tools as `ToolDef` records and
  register them through the shared factories. Each tool file is now
  ~60–70% smaller and the GET → JSON → MCP-text pattern lives in one place.
- **List responses now lead with a one-line `NOTE:` header** describing what
  the model is seeing (total rows, filter match count, truncation status).
  Single-object responses are unchanged unless they exceed 64 KB.
- **Tool descriptions tightened** — removed redundant phrasing and pushed
  parameter documentation into Zod `.describe()` strings, where the model
  reads it directly from the JSON schema.
- **`scripts/verify-tool-paths.mjs`** — extended to recognise the new
  `path: "/api/..."` declaration form alongside the legacy direct call form.

### Notes for callers

- Existing callers that invoke list tools with no arguments still work but
  will now see **at most 50 rows** plus the `NOTE:` line. To see more, pass
  `{ limit: 200 }` or narrow with `filter`.
- Single-object tool output is byte-for-byte identical to before unless the
  payload is over 64 KB.

### Stats

| Metric | Before | After |
|--|--|--|
| Tool files (LoC) | ~1100 | ~430 |
| Boilerplate per tool | ~18 lines | ~7 lines (`ToolDef` record) |
| List-tool inputs | none | `fields`, `filter`, `limit` |
| Default rows returned | unbounded | capped at 50 |
| Output byte ceiling | none | 64 KB |
| Tool paths verified | 41/41 | 41/41 |

### Suggested follow-ups (not in this release)

- **Aggregate tools** (e.g. `ras_health_overview`, `ras_capacity_snapshot`) —
  collapse common multi-tool admin workflows into one call. Sits cleanly on
  top of the new shaping primitives.
- **MCP `resources` for reference data** (themes, certs, SAML IdPs, farm
  config) — move static reference data out of the tool list and into the
  `resources` capability, so the model reads them on demand rather than
  spending tool slots on them.

## [1.1.0] — 2026-04-28

- Adds an opt-in streamable-HTTP transport with bearer-token auth, alongside
  the existing stdio transport.

## [1.0.1]

- Corrects all 41 tool paths against the Parallels RAS v21 REST API and adds
  a build-time path verifier (`scripts/verify-tool-paths.mjs`) against the
  bundled OpenAPI spec.

## [1.0.0]

- Draft scaffold; REST API paths had been modelled from the documentation
  table-of-contents headings rather than the real endpoints. Superseded by
  v1.0.1.
