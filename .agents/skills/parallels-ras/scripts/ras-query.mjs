#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(
  process.env.PARALLELS_RAS_MCP_ROOT ?? path.join(scriptDir, "../../../.."),
);
const entryPoint = path.join(repositoryRoot, "build", "index.js");
const packageFile = path.join(repositoryRoot, "package.json");

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

  if (!existsSync(packageFile) || !existsSync(entryPoint)) {
    fail("RAS server build not found. Set PARALLELS_RAS_MCP_ROOT to the repository and run npm install && npm run build there.");
    return;
  }

  for (const key of ["RAS_HOST", "RAS_USERNAME", "RAS_PASSWORD"]) {
    if (!process.env[key]) {
      fail(`Missing ${key} environment variable.`);
      return;
    }
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

  const requireFromRepository = createRequire(packageFile);
  const { Client } = await import(pathToFileURL(
    requireFromRepository.resolve("@modelcontextprotocol/sdk/client/index.js"),
  ).href);
  const { StdioClientTransport } = await import(pathToFileURL(
    requireFromRepository.resolve("@modelcontextprotocol/sdk/client/stdio.js"),
  ).href);

  const childEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined),
  );
  childEnvironment.MCP_TRANSPORT = "stdio";
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryPoint],
    cwd: repositoryRoot,
    env: childEnvironment,
    stderr: "inherit",
  });
  const client = new Client({ name: "parallels-ras-skill", version: "1.0.0" });

  try {
    await client.connect(transport);
    const result = action === "list"
      ? await client.listTools()
      : await client.callTool({ name: toolName, arguments: argumentsObject });
    console.log(JSON.stringify(result, null, 2));
    if (result.isError) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => fail(`RAS skill runner failed: ${error.message}`));
