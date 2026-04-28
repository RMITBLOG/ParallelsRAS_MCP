/**
 * Shared RAS REST API client for the Parallels RAS MCP Server.
 * Handles authentication, session management, headers, and GET requests.
 * Includes request timeouts, error sanitisation, and graceful shutdown.
 *
 * API surface verified against the v19 OpenAPI spec at
 *   https://update.parallels.com/ras/v19/docs/en_US/Parallels-RAS-REST-API-Guide/swagger.json
 * Real API paths are flat under /api/<PascalCaseResource> — do NOT model
 * paths after the documentation TOC headings (Infrastructure, Site Settings,
 * Farm Settings, etc.) which are narrative groupings, not URL segments.
 *
 * @author Ryan Mangan
 * @created 2026-02-10
 */

const RAS_HOST = process.env.RAS_HOST ?? "";
const RAS_USERNAME = process.env.RAS_USERNAME ?? "";
const RAS_PASSWORD = process.env.RAS_PASSWORD ?? "";
const RAS_PORT = process.env.RAS_PORT ?? "20443";
const RAS_IGNORE_TLS = (process.env.RAS_IGNORE_TLS ?? "true").toLowerCase() === "true";

/** Default request timeout in milliseconds (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000;

if (RAS_IGNORE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/**
 * Validate that all required environment variables are present.
 * Call this at startup before connecting the MCP transport.
 */
export function validateConfig(): void {
  const missing: string[] = [];
  if (!RAS_HOST) missing.push("RAS_HOST");
  if (!RAS_USERNAME) missing.push("RAS_USERNAME");
  if (!RAS_PASSWORD) missing.push("RAS_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `Set them in your AI tool's MCP server configuration.`
    );
  }
}

/**
 * Sanitise an error message to avoid leaking internal details.
 * Strips auth tokens, passwords, and excessive API response bodies.
 */
function sanitiseError(err: unknown, context: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Remove anything that looks like a token or password value
  let sanitised = raw
    .replace(/auth_token[=:]\s*\S+/gi, "auth_token=[REDACTED]")
    .replace(/password[=:]\s*\S+/gi, "password=[REDACTED]");
  // Truncate excessively long API response bodies
  if (sanitised.length > 500) {
    sanitised = sanitised.substring(0, 500) + "... (truncated)";
  }
  return `${context}: ${sanitised}`;
}

class RasClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private headers: Record<string, string> = {
    "Content-Type": "application/json; api-version=1.0",
  };

  constructor() {
    this.baseUrl = `https://${RAS_HOST}:${RAS_PORT}`;
  }

  /**
   * Authenticate with the RAS API and cache the auth token.
   */
  private async login(): Promise<void> {
    if (!RAS_HOST || !RAS_USERNAME || !RAS_PASSWORD) {
      throw new Error(
        "Missing required environment variables: RAS_HOST, RAS_USERNAME, RAS_PASSWORD"
      );
    }

    const response = await fetch(`${this.baseUrl}/api/Session/logon`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        username: RAS_USERNAME,
        password: RAS_PASSWORD,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `RAS login failed (HTTP ${response.status}): ${body.substring(0, 300)}`
      );
    }

    const data = await response.json();
    this.authToken = data.authToken ?? data.AuthToken ?? null;

    if (!this.authToken) {
      throw new Error("RAS login response did not contain an auth token");
    }
  }

  /**
   * End the current RAS API session.
   */
  async logoff(): Promise<void> {
    if (!this.authToken) return;

    try {
      await fetch(`${this.baseUrl}/api/Session/logoff`, {
        method: "POST",
        headers: {
          ...this.headers,
          auth_token: this.authToken,
        },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Best-effort logoff — ignore errors on shutdown
    }

    this.authToken = null;
  }

  /**
   * Make a GET request to the RAS API.
   * Handles lazy authentication, automatic retry on 401, and request timeouts.
   */
  async get(path: string): Promise<unknown> {
    // Ensure we have a valid session
    if (!this.authToken) {
      await this.login();
    }

    const fetchOptions = {
      method: "GET" as const,
      headers: {
        ...this.headers,
        auth_token: this.authToken!,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    let response = await fetch(`${this.baseUrl}${path}`, fetchOptions);

    // Token may have expired — re-authenticate once and retry
    if (response.status === 401) {
      await this.login();
      response = await fetch(`${this.baseUrl}${path}`, {
        ...fetchOptions,
        headers: {
          ...this.headers,
          auth_token: this.authToken!,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `RAS API error (HTTP ${response.status}) on ${path}: ${body.substring(0, 300)}`
      );
    }

    return response.json();
  }
}

export const rasClient = new RasClient();

export { sanitiseError };

// Cleanup session on process exit
const cleanup = async () => {
  await rasClient.logoff();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", async (err) => {
  console.error("Uncaught exception, shutting down:", err.message);
  await rasClient.logoff();
  process.exit(1);
});
process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled rejection, shutting down:", reason);
  await rasClient.logoff();
  process.exit(1);
});
