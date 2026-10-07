import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import test from "node:test";

process.env.RAS_HOST = "ras.test";
process.env.RAS_USERNAME = "administrator";
process.env.RAS_PASSWORD = "synthetic-password";
process.env.RAS_IGNORE_TLS = "false";
const nativeFetch = globalThis.fetch;

const jsonResponse = (value, init = {}) =>
  new Response(JSON.stringify(value), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

test("RAS authentication is single-flight and every credential-bearing request rejects redirects", async (t) => {
  let loginCalls = 0;
  let forceUnauthorized = false;
  const seen = [];

  globalThis.fetch = async (url, options = {}) => {
    seen.push({ url: String(url), options });
    if (String(url).endsWith("/api/Session/logon")) {
      loginCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ authToken: `token-${loginCalls}` });
    }
    if (String(url).endsWith("/api/Session/logoff")) {
      return new Response(null, { status: 204 });
    }
    if (forceUnauthorized && options.headers?.auth_token === "token-1") {
      return new Response(null, { status: 401 });
    }
    return jsonResponse([{ ok: true }]);
  };
  t.after(() => {
    globalThis.fetch = nativeFetch;
  });

  const { rasClient } = await import("../build/client.js");
  await Promise.all(Array.from({ length: 50 }, () => rasClient.get("/api/Test")));
  assert.equal(loginCalls, 1, "concurrent first use must create one RAS session");

  forceUnauthorized = true;
  await Promise.all(Array.from({ length: 50 }, () => rasClient.get("/api/Test")));
  assert.equal(loginCalls, 2, "concurrent 401 responses must share one refresh");

  await rasClient.logoff();
  assert.ok(seen.length > 0);
  for (const request of seen) {
    assert.equal(request.options.redirect, "error", `redirect policy missing for ${request.url}`);
  }
});

test("logoff waits for an in-flight login and closes the resulting session", async (t) => {
  const { rasClient } = await import("../build/client.js");
  let resolveLogin;
  let logoffCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/api/Session/logon")) {
      return new Promise((resolve) => {
        resolveLogin = resolve;
      });
    }
    if (String(url).endsWith("/api/Session/logoff")) {
      logoffCalls += 1;
      return new Response(null, { status: 204 });
    }
    return jsonResponse([{ ok: true }]);
  };
  t.after(() => {
    globalThis.fetch = nativeFetch;
  });

  const getPromise = rasClient.get("/api/Test");
  await new Promise((resolve) => setImmediate(resolve));
  let logoffSettled = false;
  const logoffPromise = rasClient.logoff().then(() => {
    logoffSettled = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logoffSettled, false, "logoff returned before the login completed");

  resolveLogin(jsonResponse({ authToken: "late-token" }));
  await Promise.all([getPromise, logoffPromise]);
  assert.equal(logoffCalls, 1);
});

test("caller-visible errors redact common password and token formats", async () => {
  const { sanitiseError } = await import("../build/client.js");
  const secretValues = [
    "json-secret",
    "camel-secret",
    "header-secret",
    "plain-secret",
    "encoded-secret",
    "escaped-secret",
    "basic-secret",
    "space-secret",
    "access-secret",
    "api-secret",
  ];
  const message = sanitiseError(
    new Error(
      '{"password":"json-secret","authToken":"camel-secret"} ' +
        "Authorization: Bearer header-secret password=plain-secret " +
        "password%3Dencoded-secret {\\\"authToken\\\":\\\"escaped-secret\\\"} " +
        "Authorization: Basic basic-secret password=hello space-secret; " +
        "access_token=access-secret, api-token=api-secret",
    ),
    "Synthetic failure",
  );
  for (const secret of secretValues) assert.ok(!message.includes(secret), `${secret} leaked`);
  assert.match(message, /\[REDACTED\]/);
});

test("outbound response reader cancels streams that exceed their byte ceiling", async () => {
  const { readResponseText } = await import("../build/http-body.js");
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(700_000));
      controller.enqueue(new Uint8Array(700_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readResponseText(new Response(body), 1024 * 1024),
    /upstream response exceeded/,
  );
  assert.equal(cancelled, true);
});

test("UTF-8 output shaping enforces the advertised 64 KiB ceiling", async () => {
  const { formatList } = await import("../build/tools/_format.js");
  const output = formatList({ value: "😀".repeat(40_000) });
  assert.ok(Buffer.byteLength(output, "utf8") <= 64 * 1024);
  assert.match(output, /output truncated/);
  const json = output.slice(output.indexOf("\n\n") + 2);
  assert.doesNotThrow(() => JSON.parse(json));
});

test("documentation URLs require the exact trusted HTTPS origin", async () => {
  const { isAllowedDocsUrl } = await import("../build/tools/documentation.js");
  assert.equal(isAllowedDocsUrl("https://docs.parallels.com/landing/ras"), true);
  for (const value of [
    "http://docs.parallels.com/landing/ras",
    "https://docs.parallels.com.attacker.invalid/",
    "https://attacker.invalid/",
    "https://user:pass@docs.parallels.com/",
    "https://docs.parallels.com:444/",
    "https://docs.parallels.com/page#section",
  ]) {
    assert.equal(isAllowedDocsUrl(value), false, `${value} should be rejected`);
  }
});

test("documentation output and upstream buffering are bounded", async (t) => {
  const { callDocsTool } = await import("../build/docs-client.js");
  let options;
  globalThis.fetch = async (_url, suppliedOptions) => {
    options = suppliedOptions;
    const id = JSON.parse(String(suppliedOptions.body)).id;
    const payload = {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: "😀".repeat(40_000) }] },
    };
    return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  t.after(() => {
    globalThis.fetch = nativeFetch;
  });
  const content = await callDocsTool("searchDocumentation", { query: "test" });
  assert.equal(options.redirect, "error");
  assert.ok(
    content.reduce((total, item) => total + Buffer.byteLength(item.text, "utf8"), 0) <=
      64 * 1024,
  );
  assert.match(content.at(-1).text, /output truncated/);
});

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startHttpServer() {
  const port = await reservePort();
  const token = "test-token-with-sufficient-entropy-0123456789";
  const child = spawn(process.execPath, ["build/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RAS_HOST: "ras.test",
      RAS_USERNAME: "administrator",
      RAS_PASSWORD: "synthetic-password",
      RAS_IGNORE_TLS: "false",
      RAS_ENABLE_WRITE: "false",
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_BEARER_TOKEN: token,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`HTTP server did not start: ${stderr}`)), 5_000);
    const poll = setInterval(() => {
      if (stderr.includes("listening on")) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      } else if (child.exitCode !== null) {
        clearInterval(poll);
        clearTimeout(timeout);
        reject(new Error(`HTTP server exited early: ${stderr}`));
      }
    }, 20);
  });
  return { child, port, token, stderr: () => stderr };
}

function initializeRequest(id) {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "security-regression-test", version: "1.0.0" },
    },
  };
}

function post(port, token, body) {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function expectEarlyRejection(port, token, headers, chunk) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (response) => {
        settled = true;
        response.resume();
        response.once("end", () => {
          request.destroy();
          resolve(response.statusCode);
        });
      },
    );
    request.on("error", (err) => {
      if (!settled) reject(err);
    });
    if (chunk) request.write(chunk);
    else request.flushHeaders();
    const timeout = setTimeout(() => {
      request.destroy();
      reject(new Error("server did not reject oversized request promptly"));
    }, 2_000);
    request.once("close", () => clearTimeout(timeout));
  });
}

test("HTTP transport handles repeated requests and enforces bounded authenticated input", async (t) => {
  const running = await startHttpServer();
  t.after(async () => {
    if (running.child.exitCode === null) running.child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (running.child.exitCode !== null) resolve();
      else running.child.once("exit", resolve);
    });
  });

  const unauthenticated = await fetch(`http://127.0.0.1:${running.port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(initializeRequest(0)),
  });
  assert.equal(unauthenticated.status, 401);

  for (const id of [1, 2]) {
    const response = await post(running.port, running.token, initializeRequest(id));
    assert.equal(response.status, 200, running.stderr());
    await response.text();
  }

  const tools = await post(running.port, running.token, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
    params: {},
  });
  assert.equal(tools.status, 200, running.stderr());
  assert.match(await tools.text(), /ras_infra_get_agents/);

  const oversizedBatch = await post(
    running.port,
    running.token,
    Array.from({ length: 26 }, (_, index) => initializeRequest(index + 10)),
  );
  assert.equal(oversizedBatch.status, 413);

  const declaredOversize = await expectEarlyRejection(
    running.port,
    running.token,
    { "Content-Length": String(1024 * 1024 + 1) },
  );
  assert.equal(declaredOversize, 413);

  const chunkedOversize = await expectEarlyRejection(
    running.port,
    running.token,
    { "Transfer-Encoding": "chunked" },
    Buffer.alloc(1024 * 1024 + 1, "x"),
  );
  assert.equal(chunkedOversize, 413);

  const malformed = await post(running.port, running.token, "{");
  assert.equal(malformed.status, 400);
  const recovery = await post(running.port, running.token, initializeRequest(100));
  assert.equal(recovery.status, 200, running.stderr());
  await recovery.text();

  const heldRequests = Array.from({ length: 16 }, () => {
    const request = http.request({
      host: "127.0.0.1",
      port: running.port,
      path: "/mcp",
      method: "POST",
      headers: {
        Authorization: `Bearer ${running.token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Content-Length": "2",
      },
    });
    request.on("response", (response) => response.resume());
    request.on("error", () => {});
    request.write("{");
    return request;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const saturated = await post(running.port, running.token, initializeRequest(101));
  assert.equal(saturated.status, 503);
  for (const request of heldRequests) request.end("}");

  await new Promise((resolve) => setTimeout(resolve, 100));
  const recovered = await post(running.port, running.token, initializeRequest(102));
  assert.equal(recovered.status, 200, running.stderr());
  await recovered.text();
});
