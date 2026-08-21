/**
 * Shared HMAC signing for the Scrandle render endpoints.
 *
 * The Worker builds an image URL, signs the payload, and hands the URL to
 * Discord. Discord fetches it. Without the signature these routes would be an
 * open image proxy that renders any URL anyone hands them.
 *
 * The Worker side of this lives in scrandle-worker/src/images.ts and must stay
 * byte-compatible with it.
 */

export function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf-8");
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlEncode(input: string): string {
  return toBase64Url(Buffer.from(input, "utf-8").toString("base64"));
}

/** Raw bytes, not text — routing an HMAC through UTF-8 mangles every byte over 127. */
export function base64UrlEncodeBytes(bytes: ArrayBuffer): string {
  return toBase64Url(Buffer.from(bytes).toString("base64"));
}

export async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return base64UrlEncodeBytes(mac);
}

/** Constant-time-ish comparison. Short strings, but no reason to leak timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export type PayloadResult<T> =
  | { ok: true; payload: T }
  | { ok: false; status: number; error: string };

/**
 * Verifies `?d=<base64url json>&s=<hmac>` and returns the decoded payload.
 */
export async function readSignedPayload<T>(
  url: URL
): Promise<PayloadResult<T>> {
  const secret = process.env.SCRANDLE_IMAGE_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "SCRANDLE_IMAGE_SECRET is not configured",
    };
  }

  const data = url.searchParams.get("d");
  const signature = url.searchParams.get("s");
  if (!data || !signature) {
    return { ok: false, status: 400, error: "Missing 'd' or 's'" };
  }

  const expected = await sign(secret, data);
  if (!safeEqual(expected, signature)) {
    return { ok: false, status: 403, error: "Bad signature" };
  }

  try {
    return { ok: true, payload: JSON.parse(base64UrlDecode(data)) as T };
  } catch {
    return { ok: false, status: 400, error: "Malformed payload" };
  }
}
