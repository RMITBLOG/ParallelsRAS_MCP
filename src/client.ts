/**
 * Shared RAS REST API client for the Parallels RAS MCP Server.
 * Handles authentication, session management, headers, and RAS requests.
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

import { readResponseText } from "./http-body.js";
import type { WriteMethod } from "./write-operations.js";

const RAS_HOST = process.env.RAS_HOST ?? "";
const RAS_USERNAME = process.env.RAS_USERNAME ?? "";
const RAS_PASSWORD = process.env.RAS_PASSWORD ?? "";
const RAS_PORT = process.env.RAS_PORT ?? "20443";
const RAS_IGNORE_TLS = (process.env.RAS_IGNORE_TLS ?? "true").toLowerCase() === "true";

/** Default request timeout in milliseconds (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000;
/** Bound complete RAS JSON responses before parsing them. */
const MAX_RAS_RESPONSE_BYTES = 16 * 1024 * 1024;

if (RAS_IGNORE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.error(
    "WARNING: RAS_IGNORE_TLS=true disables TLS certificate verification for this process. " +
      "Use only on a trusted network; prefer RAS_IGNORE_TLS=false with NODE_EXTRA_CA_CERTS.",
  );
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
  // Defense in depth: caller-visible errors should never contain upstream bodies,
  // but still scrub common structured and header-style secret formats.
  let sanitised = raw
    .replace(
      /\bAuthorization\s*:\s*(?:Basic|Bearer)\s+[^\s,;}]+/gi,
      "Authorization: [REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /((?:password|passphrase|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?(?:key|token)|secret|authorization)(?:\\?["'])?\s*[:=]\s*(?:\\?["'])?)[^,;}\]\r\n]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:password|passphrase|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?(?:key|token)|secret|authorization)(?:%22)?(?:%3A|%3D)(?:%22)?)[^&\s]+/gi,
      "$1[REDACTED]",
    );
  // Truncate excessively long API response bodies
  if (sanitised.length > 500) {
    sanitised = sanitised.substring(0, 500) + "... (truncated)";
  }
  return `${context}: ${sanitised}`;
}

class RasClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private loginPromise: Promise<void> | null = null;
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
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`RAS login failed (HTTP ${response.status})`);
    }

    const body = await readResponseText(response, MAX_RAS_RESPONSE_BYTES);
    const data = JSON.parse(body) as { authToken?: unknown; AuthToken?: unknown };
    const token = data.authToken ?? data.AuthToken;
    if (typeof token !== "string" || !token) {
      throw new Error("RAS login response did not contain an auth token");
    }
    this.authToken = token;
  }

  /** Coalesce simultaneous first-use and refresh logins into one request. */
  private async ensureAuthenticated(): Promise<void> {
    if (this.authToken) return;
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null;
      });
    }
    await this.loginPromise;
  }

  /** Refresh once for every group of requests that used the same stale token. */
  private async refreshAfterUnauthorized(staleToken: string): Promise<void> {
    if (this.authToken && this.authToken !== staleToken) return;
    this.authToken = null;
    await this.ensureAuthenticated();
  }

  /**
   * End the current RAS API session.
   */
  async logoff(): Promise<void> {
    if (this.loginPromise) {
      try {
        await this.loginPromise;
      } catch {
        return;
      }
    }
    if (!this.authToken) return;

    const token = this.authToken;
    this.authToken = null;

    try {
      await fetch(`${this.baseUrl}/api/Session/logoff`, {
        method: "POST",
        headers: {
          ...this.headers,
          auth_token: token,
        },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Best-effort logoff — ignore errors on shutdown
    }

  }

  /**
   * Make a GET request to the RAS API.
   * Handles lazy authentication, automatic retry on 401, and request timeouts.
   */
  async get(path: string): Promise<unknown> {
    // Ensure we have a valid session
    if (!this.authToken) {
      await this.ensureAuthenticated();
    }

    const requestToken = this.authToken!;

    const fetchOptions = {
      method: "GET" as const,
      headers: {
        ...this.headers,
        auth_token: requestToken,
      },
      redirect: "error" as const,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    let response = await fetch(`${this.baseUrl}${path}`, fetchOptions);

    // Token may have expired — re-authenticate once and retry
    if (response.status === 401) {
      await response.body?.cancel();
      await this.refreshAfterUnauthorized(requestToken);
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
      await response.body?.cancel();
      throw new Error(`RAS API error (HTTP ${response.status}) on ${path}`);
    }

    const body = await readResponseText(response, MAX_RAS_RESPONSE_BYTES);
    return JSON.parse(body) as unknown;
  }

  /** Send one write request. Never replay a mutation after an uncertain result. */
  async write(
    method: WriteMethod,
    pathAndQuery: string,
    body?: BodyInit,
    contentType?: string,
  ): Promise<{ status: number; data?: unknown }> {
    await this.ensureAuthenticated();
    const headers: Record<string, string> = {
      auth_token: this.authToken!,
    };
    if (contentType) headers["Content-Type"] = contentType;

    const response = await fetch(`${this.baseUrl}${pathAndQuery}`, {
      method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`RAS write failed (HTTP ${response.status})`);
    }
    const responseText = await readResponseText(response, MAX_RAS_RESPONSE_BYTES);
    if (!responseText) return { status: response.status };
    const responseType = response.headers.get("content-type") ?? "";
    if (responseType.toLowerCase().includes("json")) {
      try {
        return { status: response.status, data: JSON.parse(responseText) as unknown };
      } catch {
        throw new Error("RAS write returned invalid JSON");
      }
    }
    return { status: response.status, data: responseText };
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
