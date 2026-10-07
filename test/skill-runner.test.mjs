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

test("skill runner discovers the shared read-only RAS catalog", async () => {
  const { stdout } = await run(process.execPath, [fileURLToPath(script), "list"], { env });
  const result = JSON.parse(stdout);
  assert.equal(result.tools.length, 41);
  assert.ok(result.tools.some((tool) => tool.name === "ras_farm_get_version"));
  assert.ok(result.tools.some((tool) => tool.name === "ras_sessions_list"));
  assert.equal(stdout.includes("synthetic-password"), false);
});

test("skill runner calls the RAS client directly and narrows its output", async () => {
  const fakeApi = `globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/api/Session/logon" && options.method === "POST") {
      return new Response(JSON.stringify({authToken: "synthetic-token"}), {status: 200});
    }
    if (path === "/api/Agent" && options.method === "GET" &&
        options.headers?.auth_token === "synthetic-token") {
      return new Response(JSON.stringify([
        {hostname: "host-1", privateField: "do-not-output"},
        {hostname: "host-2", privateField: "do-not-output"}
      ]), {status: 200});
    }
    if (path === "/api/Session/logoff" && options.method === "POST") {
      return new Response(null, {status: 204});
    }
    throw new Error("Unexpected outbound request");
  };`;
  const preload = `data:text/javascript,${encodeURIComponent(fakeApi)}`;
  const { stdout } = await run(process.execPath, [
    "--import", preload,
    fileURLToPath(script), "call", "ras_infra_get_agents",
    JSON.stringify({ fields: ["hostname"], limit: 1 }),
  ], { env });
  assert.match(stdout, /host-1/);
  assert.doesNotMatch(stdout, /host-2|do-not-output|synthetic-password/);
  assert.match(stdout, /showing first 1/);
});
