import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = new URL("../.agents/skills/parallels-ras/scripts/ras-query.mjs", import.meta.url);
const env = {
  ...process.env,
  RAS_HOST: "ras.test",
  RAS_USERNAME: "administrator",
  RAS_PASSWORD: "synthetic-password",
  RAS_IGNORE_TLS: "false",
};

test("skill runner discovers the local server's read-only tools", async () => {
  const { stdout } = await run(process.execPath, [fileURLToPath(script), "list"], { env });
  const result = JSON.parse(stdout);
  assert.ok(result.tools.some((tool) => tool.name === "ras_farm_get_version"));
  assert.ok(result.tools.some((tool) => tool.name === "ras_sessions_list"));
  assert.equal(stdout.includes("synthetic-password"), false);
});
