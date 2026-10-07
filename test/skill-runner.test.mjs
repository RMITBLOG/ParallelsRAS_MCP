import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = new URL("../.agents/skills/parallels-ras/scripts/ras-query.mjs", import.meta.url);
const fakeApi = new URL("../fixtures/fake-ras-fetch.cjs", import.meta.url);
const env = {
  ...process.env,
  RAS_HOST: "ras.test",
  RAS_USERNAME: "administrator",
  RAS_PASSWORD: "synthetic-password",
  RAS_IGNORE_TLS: "false",
  RAS_ENABLE_WRITE: "false",
};

test("skill runner discovers the shared read-only RAS catalog", async () => {
  const { stdout } = await run(process.execPath, [fileURLToPath(script), "list"], { env });
  const result = JSON.parse(stdout);
  assert.equal(result.tools.length, 43);
  assert.ok(result.tools.some((tool) => tool.name === "ras_farm_get_version"));
  assert.ok(result.tools.some((tool) => tool.name === "ras_sessions_list"));
  assert.ok(result.tools.some((tool) => tool.name === "ras_docs_search"));
  assert.ok(result.tools.some((tool) => tool.name === "ras_docs_get_page"));
  assert.equal(stdout.includes("synthetic-password"), false);
});

test("skill runner exposes opt-in writes and accepts mutation JSON only on stdin", () => {
  const writeEnv = { ...env, RAS_ENABLE_WRITE: "true" };
  const list = JSON.parse(execFileSync(process.execPath, [fileURLToPath(script), "list"], { env: writeEnv, encoding: "utf8" }));
  assert.equal(list.tools.length, 45);
  assert.ok(list.tools.some((tool) => tool.name === "ras_write_request"));

  const output = execFileSync(process.execPath, [
    "--require", fileURLToPath(fakeApi), fileURLToPath(script),
    "call", "ras_write_request", "-",
  ], {
    env: writeEnv,
    encoding: "utf8",
    input: JSON.stringify({ method: "POST", path: "/api/Settings/apply" }),
  });
  assert.match(output, /"status": 204/);
  assert.doesNotMatch(output, /synthetic-password|synthetic-token/);
});

test("skill runner searches and fetches documentation with URL validation", () => {
  const args = ["--require", fileURLToPath(fakeApi), fileURLToPath(script), "call"];
  const search = execFileSync(process.execPath,
    [...args, "ras_docs_search", JSON.stringify({ query: "RDS hosts" })],
    { env, encoding: "utf8" });
  assert.match(search, /Synthetic documentation search result/);

  const page = execFileSync(process.execPath,
    [...args, "ras_docs_get_page", JSON.stringify({ url: "https://docs.parallels.com/landing/ras" })],
    { env, encoding: "utf8" });
  assert.match(page, /Synthetic documentation page/);

  const longPage = execFileSync(process.execPath,
    [...args, "ras_docs_get_page", JSON.stringify({ url: "https://docs.parallels.com/landing/long" })],
    { env, encoding: "utf8" });
  assert.ok(longPage.length > 50_000);
  assert.ok(Buffer.byteLength(longPage, "utf8") <= 64 * 1024);

  assert.throws(() => execFileSync(process.execPath,
    [...args, "ras_docs_get_page", JSON.stringify({ url: "https://docs.parallels.com.attacker.invalid/" })],
    { env, encoding: "utf8", stdio: "pipe" }), /Expected an HTTPS docs.parallels.com URL/);
});

test("skill runner calls the RAS client directly and narrows its output", async () => {
  const { stdout } = await run(process.execPath, [
    "--require", fileURLToPath(fakeApi),
    fileURLToPath(script), "call", "ras_infra_get_agents",
    JSON.stringify({ fields: ["hostname"], limit: 1 }),
  ], { env });
  assert.match(stdout, /host-1/);
  assert.doesNotMatch(stdout, /host-2|do-not-output|synthetic-password/);
  assert.match(stdout, /showing first 1/);
});
