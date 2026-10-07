import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { unzipSync } from "fflate";

const run = promisify(execFile);
const archive = fileURLToPath(new URL("../skill-packages/parallels-ras-skill.zip", import.meta.url));
const fakeApi = fileURLToPath(new URL("../fixtures/fake-ras-fetch.cjs", import.meta.url));

test("ZIP imports and runs without a source checkout or node_modules", async (t) => {
  const tempRoot = realpathSync(os.tmpdir());
  const extracted = mkdtempSync(path.join(tempRoot, "parallels-ras-skill-"));
  t.after(() => {
    if (path.dirname(extracted) !== tempRoot) throw new Error("Unsafe test cleanup target");
    rmSync(extracted, { recursive: true, force: true });
  });

  const entries = unzipSync(new Uint8Array(readFileSync(archive)));
  assert.deepEqual(Object.keys(entries).sort(), [
    "parallels-ras/SKILL.md",
    "parallels-ras/scripts/ras-query.mjs",
  ]);
  for (const [name, contents] of Object.entries(entries)) {
    const destination = path.join(extracted, name);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }

  const script = path.join(extracted, "parallels-ras", "scripts", "ras-query.mjs");
  const fakeApiCopy = path.join(extracted, "fake-ras-fetch.cjs");
  writeFileSync(fakeApiCopy, readFileSync(fakeApi));
  const env = {
    ...process.env,
    PARALLELS_RAS_MCP_ROOT: path.join(extracted, "no-repository-here"),
    RAS_HOST: "ras.test",
    RAS_USERNAME: "administrator",
    RAS_PASSWORD: "synthetic-password",
    RAS_IGNORE_TLS: "false",
    RAS_ENABLE_WRITE: "false",
  };

  const list = await run(process.execPath, [script, "list"], { cwd: extracted, env });
  assert.equal(JSON.parse(list.stdout).tools.length, 43);
  const call = await run(process.execPath, [
    "--require", fakeApiCopy, script, "call", "ras_infra_get_agents",
    JSON.stringify({ fields: ["hostname"], limit: 1 }),
  ], { cwd: extracted, env });
  assert.match(call.stdout, /host-1/);
  assert.doesNotMatch(call.stdout, /host-2|do-not-output|synthetic-password/);

  const docs = await run(process.execPath, [
    "--require", fakeApiCopy, script, "call", "ras_docs_get_page",
    JSON.stringify({ url: "https://docs.parallels.com/landing/long" }),
  ], { cwd: extracted, env });
  assert.ok(docs.stdout.length > 50_000);
  assert.ok(Buffer.byteLength(docs.stdout, "utf8") <= 64 * 1024);

  const writeEnv = { ...env, RAS_ENABLE_WRITE: "true" };
  const writeList = await run(process.execPath, [script, "list"], { cwd: extracted, env: writeEnv });
  assert.equal(JSON.parse(writeList.stdout).tools.length, 45);
  const write = execFileSync(process.execPath, [
    "--require", fakeApiCopy, script, "call", "ras_write_request", "-",
  ], {
    cwd: extracted,
    env: writeEnv,
    encoding: "utf8",
    input: JSON.stringify({ method: "POST", path: "/api/Settings/apply" }),
  });
  assert.match(write, /"status": 204/);
});
