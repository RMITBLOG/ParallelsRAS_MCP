/** Standalone read-only RAS skill CLI. Bundled into an importable skill. */
import { rasClient, sanitiseError } from "./client.js";
import { formatList, parseListOptions, type ListShapeOptions } from "./tools/_format.js";
import { RAS_TOOLS } from "./tools/catalog.js";

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const [action, toolName, rawArguments, ...extra] = process.argv.slice(2);
  if (extra.length || !["list", "call"].includes(action) ||
      (action === "list" && (toolName || rawArguments)) ||
      (action === "call" && !toolName)) {
    fail("Usage: ras-query.mjs list | call <tool-name> [JSON-object-arguments]");
    return;
  }

  let argumentsObject: Record<string, unknown> = {};
  if (action === "call" && rawArguments !== undefined) {
    try {
      const parsed: unknown = JSON.parse(rawArguments);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        fail("Tool arguments must be a JSON object.");
        return;
      }
      argumentsObject = parsed as Record<string, unknown>;
    } catch {
      fail("Tool arguments must be a valid JSON object.");
      return;
    }
  }

  if (action === "list") {
    console.log(JSON.stringify({
      tools: RAS_TOOLS.map(({ name, title, description, kind }) => ({
        name,
        title,
        description,
        inputs: kind === "list" ? ["fields", "filter", "limit"] : [],
      })),
    }, null, 2));
    return;
  }

  const tool = RAS_TOOLS.find(({ name }) => name === toolName);
  if (!tool) {
    fail(`Unknown read-only RAS tool: ${toolName}`);
    return;
  }

  let options: ListShapeOptions = {};
  if (tool.kind === "list") {
    try {
      options = parseListOptions(argumentsObject);
    } catch {
      fail("Invalid list options. Expected optional fields (string array), filter (scalar map), and limit (integer 1-200).");
      return;
    }
  } else if (Object.keys(argumentsObject).length > 0) {
    fail("This tool does not accept arguments.");
    return;
  }

  for (const key of ["RAS_HOST", "RAS_USERNAME", "RAS_PASSWORD"]) {
    if (!process.env[key]) {
      fail(`Missing ${key} environment variable.`);
      return;
    }
  }

  try {
    const data = await rasClient.get(tool.path);
    console.log(formatList(data, options));
  } catch (error) {
    fail(sanitiseError(error, tool.errorContext));
  } finally {
    await rasClient.logoff();
  }
}

main().catch((error) => fail(`RAS skill runner failed: ${error.message}`));
