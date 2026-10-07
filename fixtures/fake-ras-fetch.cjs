globalThis.fetch = async (url, options = {}) => {
  const requestPath = new URL(url).pathname;
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
