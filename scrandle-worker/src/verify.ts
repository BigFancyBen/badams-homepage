import { hexToBytes } from "./encoding";

/**
 * Discord signs every interaction request with Ed25519 over
 * (timestamp + raw body). Reject anything that fails — Discord sends
 * deliberately bad signatures when validating your endpoint URL, and it
 * expects a 401.
 *
 * Older Workers runtimes only exposed Ed25519 under the "NODE-ED25519" name,
 * so try the standard name first and fall back.
 */
async function importKey(publicKey: string): Promise<CryptoKey> {
  const raw = hexToBytes(publicKey);
  try {
    return await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, [
      "verify",
    ]);
  } catch {
    return await crypto.subtle.importKey(
      "raw",
      raw,
      {
        name: "NODE-ED25519",
        namedCurve: "NODE-ED25519",
      } as unknown as Parameters<SubtleCrypto["importKey"]>[2],
      false,
      ["verify"]
    );
  }
}

export async function verifyDiscordRequest(
  request: Request,
  body: string,
  publicKey: string
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) return false;

  try {
    const key = await importKey(publicKey);
    return await crypto.subtle.verify(
      key.algorithm.name,
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body)
    );
  } catch {
    return false;
  }
}
