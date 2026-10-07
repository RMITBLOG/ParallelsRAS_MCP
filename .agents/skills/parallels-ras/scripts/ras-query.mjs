#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(
  process.env.PARALLELS_RAS_MCP_ROOT ?? path.join(scriptDir, "../../../.."),
);
const buildRoot = path.join(repositoryRoot, "build");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const [action, toolName, rawArguments, ...extra] = process.argv.slice(2);
  if (extra.length || !["list", "call"].includes(action) ||
      (action === "list" && (toolName || rawArguments)) ||
      (action === "call" && !toolName)) {
    fail("Usage: ras-query.mjs list | call <tool-name> [JSON-object-arguments]");
    return;
  }

  const catalogFile = path.join(buildRoot, "tools", "catalog.js");
  const clientFile = path.join(buildRoot, "client.js");
  const formatFile = path.join(buildRoot, "tools", "_format.js");
  if (![catalogFile, clientFile, formatFile].every(existsSync)) {
    fail("RAS client build not found. Set PARALLELS_RAS_MCP_ROOT to the repository and run npm install && npm run build there.");
    return;
  }

  let argumentsObject = {};
  if (action === "call" && rawArguments !== undefined) {
    try {
      argumentsObject = JSON.parse(rawArguments);
    } catch {
      fail("Tool arguments must be a valid JSON object.");
      return;
    }
    if (argumentsObject === null || Array.isArray(argumentsObject) ||
        typeof argumentsObject !== "object") {
      fail("Tool arguments must be a JSON object.");
      return;
    }
  }

  const { RAS_TOOLS } = await import(pathToFileURL(catalogFile).href);
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

  const { formatList, parseListOptions } = await import(pathToFileURL(formatFile).href);
  let options = {};
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

  const { rasClient, sanitiseError } = await import(pathToFileURL(clientFile).href);
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
