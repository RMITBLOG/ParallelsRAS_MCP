globalThis.fetch = async (url, options = {}) => {
  const requestPath = new URL(url).pathname;
  if (url === "https://docs.parallels.com/landing/~gitbook/mcp" && options.method === "POST") {
    const request = JSON.parse(options.body);
    const name = request.params.name;
    const text = name === "searchDocumentation" ? "Synthetic documentation search result" :
      name === "getPage" ? (request.params.arguments.url.endsWith("/long") ?
        "Synthetic documentation page " + "x".repeat(50_000) : "Synthetic documentation page") : null;
    if (text === null) throw new Error("Unexpected documentation tool");
    return new Response(`data: ${JSON.stringify({ jsonrpc: "2.0", id: request.id,
      result: { content: [{ type: "text", text }] } })}\n\n`, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  if (requestPath === "/api/Session/logon" && options.method === "POST") {
    return new Response(JSON.stringify({ authToken: "synthetic-token" }), { status: 200 });
  }
  if (requestPath === "/api/Agent" && options.method === "GET" &&
      options.headers?.auth_token === "synthetic-token") {
    return new Response(JSON.stringify([
      { hostname: "host-1", privateField: "do-not-output" },
      { hostname: "host-2", privateField: "do-not-output" },
    ]), { status: 200 });
  }
  if (requestPath === "/api/Session/logoff" && options.method === "POST") {
    return new Response(null, { status: 204 });
  }
  if (requestPath === "/api/Settings/apply" && options.method === "POST" &&
      options.headers?.auth_token === "synthetic-token") {
    return new Response(null, { status: 204 });
  }
  throw new Error("Unexpected outbound request");
};
