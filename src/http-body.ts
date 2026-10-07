/**
 * Bounded HTTP response-body helpers shared by outbound clients.
 *
 * @author Ryan Mangan
 * @created 2026-10-07
 */

/** Raised when an upstream response exceeds its configured byte ceiling. */
export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`upstream response exceeded ${maxBytes} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

/** Read a response body without allowing unbounded heap growth. */
export async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && length > maxBytes) {
      await response.body?.cancel();
      throw new ResponseTooLargeError(maxBytes);
    }
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ResponseTooLargeError(maxBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

/** Truncate text at a valid UTF-8 boundary. */
export function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength <= maxBytes) return value;

  let end = maxBytes;
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1;
  return encoded.subarray(0, end).toString("utf8");
}
