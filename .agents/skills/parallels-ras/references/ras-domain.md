# RAS domain guide

Read this when explaining a RAS environment, choosing diagnostic queries, or interpreting partial results. This is a compact map of Parallels RAS v21 concepts, not a replacement for the [Administrator's Guide](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide) or [REST API guide](https://docs.parallels.com/landing/ras-rest-api-guide).

## Architecture and scope

- A **Farm** is the administrative deployment. A Farm may contain multiple **Sites**; Site settings and component inventories should be interpreted in the Site being queried. Confirm the Farm version and Site before comparing results from different environments. [Adding a Site](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/farm-and-sites/adding-a-site-to-the-farm)
- A **Secure Gateway** receives client connections. It passes access requests to a **Connection Broker**, which performs security and load-balancing checks and identifies a resource host. Depending on connection mode, the client connects through the gateway or directly to the host. A standard Site has a primary broker and gateway; multi-tenant architectures can use shared gateways instead of local ones. [Gateway overview](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/ras-secure-gateway/overview), [Tenant architecture](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/ras-multi-tenant-architecture/architecture-description)
- **RD Session Hosts** supply server sessions. Host pools group hosts for publishing and management. **VDI** uses virtualization providers, host pools, templates, and guest agents. **Azure Virtual Desktop** has its own host pools and publishing model. **Remote PCs** are another resource type. Do not treat these sources as interchangeable when diagnosing a published item. [RAS components](https://docs.parallels.com/landing/ras-reference-architecture/v20/introduction/parallels-ras-components), [AVD host pools](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/azure-virtual-desktop/manage-azure-virtual-desktop/manage-host-pools-azure-virtual-desktop)
- A **published resource** is an app, desktop, or folder presented to a user. Its visibility and launchability depend on target hosts, status, and access settings. A published folder can pass its status to children, so inspect the hierarchy before explaining why an item is unavailable. [Publishing management](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/publishing/general-management-tasks), [Publishing a desktop](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/publishing/publishing-a-desktop)
- **Sessions** are live user connections, distinct from published-resource definitions. Disconnect, logoff, and process termination have different operational effects. [Managing sessions](https://docs.parallels.com/landing/ras-admin-guide/parallels-ras-21-administrators-guide/session-management/managing-sessions)

## Choose the next read

| Question | Start with | Correlate with |
| --- | --- | --- |
| Is the service or a Site healthy? | `ras_farm_get_version`, `ras_infra_get_sites`, `ras_infra_get_agents` | `ras_infra_get_connection_brokers`, `ras_infra_get_gateway_status` |
| Can users reach or authenticate? | Gateway, broker, and Site status | `ras_site_get_connection_settings`, `ras_site_get_mfa`, `ras_site_get_ad_integration`, `ras_infra_get_saml_idps` |
| Why is an app or desktop missing? | `ras_pub_get_all_items`, source-specific publishing query | Folders, policies, source hosts or pools, active sessions |
| Are sessions uneven or hosts unavailable? | `ras_sessions_list`, `ras_infra_get_rds_hosts`, `ras_infra_get_rds_hostpools` | `ras_site_get_load_balancing`, broker and agent status |
| Is a VDI or AVD resource affected? | `ras_infra_get_providers`, VDI pools/templates | AVD publishing query, relevant host-pool data, agent status |
| Is an access setting different from expectation? | Site, policy, or farm query for that setting | Official documentation for scope and inheritance |

These are investigation starting points, not health rules. An empty response can reflect permissions, Site scope, API behavior, filtering, or genuinely no configured objects. The tool catalog has 41 selected read endpoints, not every GET in the REST API. Use `ras_docs_search` and `ras_docs_get_page` for authoritative feature descriptions, and say when the available query cannot establish the answer.
