/** Opt-in RAS write requests constrained to the documented v21.2 operation catalog. */
import { z } from "zod";
import { rasClient } from "./client.js";
import { WRITE_OPERATIONS, type WriteMethod } from "./write-operations.js";

const MAX_WRITE_BODY_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_WRITE_BODY_BYTES / 3) * 4;
const scalar = z.union([z.string(), z.number(), z.boolean()]);
const namedScalar = z.object({ name: z.string().min(1), value: scalar }).strict();

export const WRITE_INPUT_SCHEMA = {
  method: z.enum(["POST", "PUT", "DELETE"]),
  path: z.string().min(1).describe("Absolute /api/ path from ras_write_operations; omit query string."),
  query: z.array(namedScalar).max(100).optional().describe("Query parameters as name/value pairs."),
  jsonBody: z.unknown().optional().describe("JSON request body, if required by the endpoint."),
  formFields: z.array(namedScalar).max(100).optional().describe("Multipart text fields."),
  files: z.array(z.object({
    name: z.string().min(1),
    fileName: z.string().min(1),
    mediaType: z.string().min(1),
    base64: z.string().min(1),
  }).strict()).max(10).optional().describe("Multipart files encoded as base64."),
  rawBase64: z.string().optional().describe("Raw request body encoded as base64."),
  contentType: z.string().optional().describe("Required media type when rawBase64 is supplied."),
};

export type WriteInput = z.infer<z.ZodObject<typeof WRITE_INPUT_SCHEMA>>;

export function isWriteEnabled(): boolean {
  return (process.env.RAS_ENABLE_WRITE ?? "false").toLowerCase() === "true";
}

export function parseWriteInput(value: unknown): WriteInput {
  return z.object(WRITE_INPUT_SCHEMA).strict().parse(value);
}

const operationPatterns = WRITE_OPERATIONS.map(([method, template]) => {
  const escaped = template.split("/").map((segment) =>
    /^\{[^{}]+\}$/.test(segment)
      ? "[^/]+"
      : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("/");
  return { method, template, regex: new RegExp(`^${escaped}$`, "i") };
});

function normalisePath(path: string): string {
  if (!path.startsWith("/api/") || /[?#\\]/.test(path)) {
    throw new Error("Write path must be an absolute /api/ path without a query or fragment");
  }
  const parts = path.split("/");
  if (parts.some((part, index) => index > 0 && part === "")) {
    throw new Error("Write path contains an empty segment");
  }
  return parts.map((part, index) => {
    if (index === 0) return "";
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      throw new Error("Write path contains invalid percent encoding");
    }
    if (!decoded || decoded === "." || decoded === ".." || /[\/%?#\\\u0000-\u001f\u007f]/.test(decoded)) {
      throw new Error("Write path contains an unsafe segment");
    }
    return encodeURIComponent(decoded);
  }).join("/");
}

function toBytes(base64: string): Buffer {
  if (base64.length > MAX_BASE64_CHARS || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Invalid or oversized base64 write body");
  }
  const data = Buffer.from(base64, "base64");
  if (data.length > MAX_WRITE_BODY_BYTES || data.toString("base64") !== base64) {
    throw new Error("Invalid or oversized base64 write body");
  }
  return data;
}

function safeFieldName(value: string): void {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(value)) {
    throw new Error("Invalid query or multipart field name");
  }
}

export function listWriteOperations(search = "", limit = 50, offset = 0): Array<{ method: WriteMethod; path: string }> {
  if (!isWriteEnabled()) throw new Error("RAS write support is disabled");
  if (search.length > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0) {
    throw new Error("Invalid write operation search, limit, or offset");
  }
  const needle = search.toLowerCase();
  return WRITE_OPERATIONS
    .filter(([method, path]) => `${method} ${path}`.toLowerCase().includes(needle))
    .slice(offset, offset + limit)
    .map(([method, path]) => ({ method, path }));
}

export async function executeWrite(value: unknown): Promise<{ status: number; data?: unknown }> {
  if (!isWriteEnabled()) throw new Error("RAS write support is disabled; set RAS_ENABLE_WRITE=true to opt in");
  const input = parseWriteInput(value);
  const path = normalisePath(input.path);
  if (!operationPatterns.some((operation) => operation.method === input.method && operation.regex.test(path))) {
    throw new Error("Method and path are not in the documented RAS v21.2 write catalog");
  }

  const url = new URL(`https://ras.invalid${path}`);
  for (const parameter of input.query ?? []) {
    safeFieldName(parameter.name);
    url.searchParams.append(parameter.name, String(parameter.value));
  }

  const hasJson = input.jsonBody !== undefined;
  const hasMultipart = input.formFields !== undefined || input.files !== undefined;
  const hasRaw = input.rawBase64 !== undefined;
  if (Number(hasJson) + Number(hasMultipart) + Number(hasRaw) > 1) {
    throw new Error("Choose one write body format: JSON, multipart, or raw base64");
  }
  if (input.contentType && !hasRaw) {
    throw new Error("contentType is only valid with rawBase64");
  }

  let body: BodyInit | undefined;
  let contentType: string | undefined;
  if (hasJson) {
    const json = JSON.stringify(input.jsonBody);
    if (json === undefined || Buffer.byteLength(json, "utf8") > MAX_WRITE_BODY_BYTES) {
      throw new Error("JSON write body is invalid or too large");
    }
    body = json;
    contentType = "application/json; api-version=1.0";
  } else if (hasMultipart) {
    const form = new FormData();
    let totalBytes = 0;
    for (const field of input.formFields ?? []) {
      safeFieldName(field.name);
      const text = String(field.value);
      totalBytes += Buffer.byteLength(text, "utf8");
      form.append(field.name, text);
    }
    for (const file of input.files ?? []) {
      safeFieldName(file.name);
      if (/[/\\\u0000-\u001f\u007f]/.test(file.fileName) || file.fileName.length > 255 ||
          !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(file.mediaType)) {
        throw new Error("Invalid multipart file metadata");
      }
      const data = toBytes(file.base64);
      totalBytes += data.length;
      if (totalBytes > MAX_WRITE_BODY_BYTES) throw new Error("Multipart write body is too large");
      form.append(file.name, new Blob([new Uint8Array(data)], { type: file.mediaType }), file.fileName);
    }
    body = form;
  } else if (hasRaw) {
    if (!input.contentType || !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+(?:;[ A-Za-z0-9=.+-]+)?$/.test(input.contentType)) {
      throw new Error("Raw write body requires a valid contentType");
    }
    body = new Uint8Array(toBytes(input.rawBase64!));
    contentType = input.contentType;
  }

  return rasClient.write(input.method, `${url.pathname}${url.search}`, body, contentType);
}
