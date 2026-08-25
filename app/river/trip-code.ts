/**
 * Trip codes, and the envelope Discord carries one in.
 *
 * The game mints a code out of three run-together river words —
 * `FrothGorgeSurf`, `PortageSieveBeater` — and its wordlist is letters only on
 * purpose: `Net.classify_join()` in the game reads anything with a dot or a
 * colon in it as an address to dial instead. The same rule is what makes this
 * safe to put in a URL path, so it is asserted here rather than assumed.
 *
 * Mirrors `DiscordSocial.join_code_from()` in the game
 * (`scripts/autoload/discord_social.gd`). The prefix is versioned there so a
 * build can tell a secret it understands from one it does not; if it ever
 * becomes `mfrs2:`, this file learns about it and keeps accepting both.
 */

const SECRET_PREFIXES = ["mfrs1:"];

/** Three words of river vocabulary, run together. Nothing else. */
const CODE_PATTERN = /^[A-Za-z]{3,60}$/;

export function isTripCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * The trip code out of a Discord join secret, or null if this is not one of
 * ours. A secret we do not recognise can only come from a build whose envelope
 * we do not know, and the honest thing to do with it is show the marketing
 * page rather than send somebody to a trip that will refuse them.
 */
export function tripCodeFromSecret(secret: string | null): string | null {
  if (!secret) return null;
  const text = secret.trim();
  const prefix = SECRET_PREFIXES.find((p) => text.startsWith(p));
  if (!prefix) return null;
  const code = text.slice(prefix.length).trim();
  return isTripCode(code) ? code : null;
}
