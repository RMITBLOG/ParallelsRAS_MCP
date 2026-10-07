/** Fixed read-only RAS catalog derived from the definitions registered by MCP. */
import type { ToolDef } from "./_format.js";
import { TOOLS as infrastructure } from "./infrastructure.js";
import { LIST_TOOLS as siteLists, OBJECT_TOOLS as siteObjects } from "./site-settings.js";
import { TOOLS as policies } from "./policies.js";
import { LIST_TOOLS as farmLists, OBJECT_TOOLS as farmObjects } from "./farm-settings.js";
import { LIST_TOOLS as publishingLists, OBJECT_TOOLS as publishingObjects } from "./publishing.js";
import { TOOLS as sessions } from "./rd-sessions.js";

export type CatalogTool = ToolDef & { kind: "list" | "object" };

const asList = (tools: ToolDef[]): CatalogTool[] =>
  tools.map((tool) => ({ ...tool, kind: "list" }));
const asObject = (tools: ToolDef[]): CatalogTool[] =>
  tools.map((tool) => ({ ...tool, kind: "object" }));

export const RAS_TOOLS: CatalogTool[] = [
  ...asList(infrastructure),
  ...asList(siteLists),
  ...asObject(siteObjects),
  ...asList(policies),
  ...asList(farmLists),
  ...asObject(farmObjects),
  ...asList(publishingLists),
  ...asObject(publishingObjects),
  ...asList(sessions),
];
