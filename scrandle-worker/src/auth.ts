/**
 * The gate on the hand-driven routes: `Authorization: Bearer <secret>`.
 *
 * A header rather than `?secret=`, which is where this used to live. A query
 * string is part of the URL, and a URL is the one thing every layer writes
 * down — the Workers request log, a shell history, a proxy in between — so a
 * secret carried there is in a log the first time it is used.
 *
 * An unset secret refuses everybody rather than matching an absent header.
 */
export async function authorized(
  request: Request,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  return sameString(match[1].trim(), secret);
}

/**
 * Compares digests rather than the strings themselves, so the time taken says
 * nothing about how much of a guess was right, or how long the secret is.
 */
async function sameString(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
