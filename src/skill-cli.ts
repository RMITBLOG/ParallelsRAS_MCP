/** Standalone read-only RAS skill CLI. Bundled into an importable skill. */
import { rasClient, sanitiseError } from "./client.js";
import { formatList, parseListOptions, type ListShapeOptions } from "./tools/_format.js";
import { RAS_TOOLS } from "./tools/catalog.js";
import { executeWrite, isWriteEnabled, listWriteOperations } from "./write.js";
import { WRITE_OPERATIONS } from "./write-operations.js";

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 12 * 1024 * 1024) throw new Error("Input is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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
      const parsed: unknown = JSON.parse(rawArguments === "-" ? await readStdin() : rawArguments);
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
      tools: [...RAS_TOOLS.map(({ name, title, description, kind }) => ({
        name,
        title,
        description,
        inputs: kind === "list" ? ["fields", "filter", "limit"] : [],
      })), ...(isWriteEnabled() ? [
        { name: "ras_write_operations", title: "Find RAS write operations", description: "Search the documented v21.2 write catalog", inputs: ["search", "limit", "offset"] },
        { name: "ras_write_request", title: "Change Parallels RAS configuration", description: "Execute one documented write request", inputs: ["method", "path", "query", "jsonBody", "formFields", "files", "rawBase64", "contentType"] },
      ] : [])],
    }, null, 2));
    return;
  }

  if (isWriteEnabled() && toolName === "ras_write_operations") {
    const { search = "", limit = 50, offset = 0, ...rest } = argumentsObject;
    if (Object.keys(rest).length || typeof search !== "string" ||
        typeof limit !== "number" || !Number.isInteger(limit) ||
        typeof offset !== "number" || !Number.isInteger(offset)) {
      fail("Invalid write operation search options");
      return;
    }
    try {
      console.log(formatList({ totalOperations: WRITE_OPERATIONS.length, matches: listWriteOperations(search, limit, offset) }));
    } catch (error) {
      fail(sanitiseError(error, "Write catalog failed"));
    }
    return;
  }

  if (isWriteEnabled() && toolName === "ras_write_request") {
    if (rawArguments !== "-") {
      fail("Write requests must pass JSON on standard input: call ras_write_request -");
      return;
    }
    try {
      console.log(formatList(await executeWrite(argumentsObject)));
    } catch (error) {
      fail(sanitiseError(error, "RAS write failed"));
    } finally {
      await rasClient.logoff();
    }
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
