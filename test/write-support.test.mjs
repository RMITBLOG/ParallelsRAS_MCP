import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";

process.env.RAS_HOST = "ras.test";
process.env.RAS_USERNAME = "administrator";
process.env.RAS_PASSWORD = "synthetic-password";
process.env.RAS_IGNORE_TLS = "false";
process.env.RAS_ENABLE_WRITE = "false";

const { executeWrite, listWriteOperations } = await import("../build/write.js");
const { WRITE_OPERATIONS } = await import("../build/write-operations.js");
const { rasClient } = await import("../build/client.js");

test("writes are disabled by default and documented operations are discoverable only after opt-in", async () => {
  assert.equal(WRITE_OPERATIONS.length, 813);
  assert.throws(() => listWriteOperations(), /disabled/);
  await assert.rejects(executeWrite({ method: "POST", path: "/api/Settings/apply" }), /disabled/);
  process.env.RAS_ENABLE_WRITE = "true";
  const matches = listWriteOperations("Settings/apply", 10);
  assert.deepEqual(matches, [{ method: "POST", path: "/api/Settings/apply" }]);
  process.env.RAS_ENABLE_WRITE = "false";
});

test("write calls enforce the v21.2 method/path catalog and do not replay on 401", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    await rasClient.logoff();
    globalThis.fetch = originalFetch;
    process.env.RAS_ENABLE_WRITE = "false";
  });
  process.env.RAS_ENABLE_WRITE = "true";

  let logons = 0;
  const writes = [];
  globalThis.fetch = async (url, options = {}) => {
    const request = new URL(url);
    if (request.pathname === "/api/Session/logon") {
      logons += 1;
      return new Response(JSON.stringify({ authToken: "synthetic-token" }), { status: 200 });
    }
    if (request.pathname === "/api/Session/logoff") return new Response(null, { status: 204 });
    writes.push({ request, options });
    if (request.pathname === "/api/AdminAccount") {
      return new Response(JSON.stringify({ id: 42 }), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response(null, { status: 401 });
  };

  for (const path of [
    "https://evil.test/api/AdminAccount",
    "/api/../AdminAccount",
    "/api/%2e%2e/AdminAccount",
    "/api/%2f/AdminAccount",
    "/api/%252e%252e/AdminAccount",
    "/api/Session/logon",
    "/api/NotDocumented",
  ]) {
    await assert.rejects(executeWrite({ method: "POST", path }), /path|catalog/i);
  }
  await assert.rejects(executeWrite({ method: "DELETE", path: "/api/AdminAccount" }), /catalog/);
  assert.equal(logons, 0);

  const created = await executeWrite({
    method: "POST",
    path: "/api/AdminAccount",
    query: [{ name: "siteId", value: 1 }],
    jsonBody: { name: "synthetic-admin" },
  });
  assert.deepEqual(created, { status: 201, data: { id: 42 } });
  assert.equal(writes[0].request.searchParams.get("siteId"), "1");
  assert.equal(writes[0].options.method, "POST");
  assert.equal(writes[0].options.headers.auth_token, "synthetic-token");
  assert.equal(writes[0].options.headers["Content-Type"], "application/json; api-version=1.0");
  assert.equal(writes[0].options.redirect, "error");

  await assert.rejects(executeWrite({ method: "POST", path: "/api/Settings/apply" }), /HTTP 401/);
  assert.equal(logons, 1);
  assert.equal(writes.length, 2);
});

test("multipart files are encoded safely and body formats cannot be mixed", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(async () => {
    await rasClient.logoff();
    globalThis.fetch = originalFetch;
    process.env.RAS_ENABLE_WRITE = "false";
  });
  process.env.RAS_ENABLE_WRITE = "true";
  let upload;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/api/Session/logon") {
      return new Response(JSON.stringify({ authToken: "synthetic-token" }), { status: 200 });
    }
    if (path === "/api/Session/logoff") return new Response(null, { status: 204 });
    upload = options;
    return new Response(null, { status: 204 });
  };
  await assert.rejects(executeWrite({
    method: "POST", path: "/api/Certificates/ImportPfx",
    jsonBody: {}, files: [],
  }), /Choose one/);
  await assert.rejects(executeWrite({
    method: "POST", path: "/api/Certificates/ImportPfx",
    files: [{ name: "PfxFile", fileName: "../secret.pfx", mediaType: "application/x-pkcs12", base64: "YQ==" }],
  }), /metadata/);
  const result = await executeWrite({
    method: "POST", path: "/api/Certificates/ImportPfx",
    formFields: [{ name: "Name", value: "test" }],
    files: [{ name: "PfxFile", fileName: "test.pfx", mediaType: "application/x-pkcs12", base64: "YQ==" }],
  });
  assert.equal(result.status, 204);
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get("Name"), "test");
  assert.equal(upload.body.get("PfxFile").name, "test.pfx");
  assert.equal(upload.headers["Content-Type"], undefined);
});

test("HTTP MCP advertises write tools only with the configuration opt-in", async (t) => {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));

  const token = "synthetic-long-test-bearer-token-0123456789";
  const child = spawn(process.execPath, ["build/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RAS_HOST: "ras.test",
      RAS_USERNAME: "administrator",
      RAS_PASSWORD: "synthetic-password",
      RAS_IGNORE_TLS: "false",
      RAS_ENABLE_WRITE: "true",
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_BEARER_TOKEN: token,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`MCP startup timed out: ${stderr}`)), 5000);
    const poll = setInterval(() => {
      if (stderr.includes("listening on")) {
        clearTimeout(timeout); clearInterval(poll); resolve();
      } else if (child.exitCode !== null) {
        clearTimeout(timeout); clearInterval(poll); reject(new Error(`MCP exited: ${stderr}`));
      }
    }, 20);
  });
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal(response.status, 200, stderr);
  const tools = await response.text();
  assert.match(tools, /ras_write_operations/);
  assert.match(tools, /ras_write_request/);
  assert.match(tools, /destructiveHint/);

  const rejected = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "ras_write_request", arguments: { method: "POST", path: "/api/NotDocumented" } },
    }),
  });
  assert.equal(rejected.status, 200, stderr);
  assert.match(await rejected.text(), /not in the documented RAS v21.2 write catalog/);
});
