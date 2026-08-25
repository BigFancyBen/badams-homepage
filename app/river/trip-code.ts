/**
 * Trip codes, and the envelope Discord carries one in.
 *
 * `isTripCode` mirrors `Link.is_trip_code()` in the game
 * (`scripts/autoload/link.gd`), which is itself `Net.classify_join()` asked
 * about shape rather than routing. The two have to agree: this page writes
 * `mfrs://join/<code>` and the game reads it, so a code accepted here and
 * refused there is a link that opens the game and then does nothing.
 *
 * The game's rules, in the game's order:
 *
 *   - not empty, and no longer than 64 characters
 *   - never starts with `-`, which is the shape of a command-line flag
 *   - no `.` and no `:`, because either one means an address the board would
 *     dial, and a link is never allowed to name a host
 *   - not `localhost`, for the same reason
 *   - letters, digits, `_` and `-` and nothing else
 *
 * Codes are three run-together river words when the meetup server has the
 * wordlist (`FrothGorgeSurf`), and 21 characters of `V1StGXR8_Z5jdHi6B-myT`
 * when it does not, which is why digits and underscores belong here.
 *
 * The secret prefix is versioned in the game so a build can tell an envelope it
 * understands from one it does not. If it ever becomes `mfrs2:`, this file
 * learns about it and keeps accepting both.
 */

const SECRET_PREFIXES = ["mfrs1:"];

/** `Link.CODE_MAX`. The string arrives off a web page; nothing else bounds it. */
const CODE_MAX = 64;

const CODE_CHARS = /^[A-Za-z0-9_-]+$/;

export function isTripCode(value: string): boolean {
  if (!value || value.length > CODE_MAX) return false;
  if (value.startsWith("-")) return false;
  if (value.toLowerCase() === "localhost") return false;
  return CODE_CHARS.test(value);
}

/**
 * The trip code out of a Discord join secret, or null if this is not one of
 * ours. A secret we do not recognise can only come from a build whose envelope
 * we do not know, and the honest thing to do with it is show the marketing page
 * rather than send somebody to a trip that will refuse them.
 */
export function tripCodeFromSecret(secret: string | null): string | null {
  if (!secret) return null;
  const text = secret.trim();
  const prefix = SECRET_PREFIXES.find((p) => text.startsWith(p));
  if (!prefix) return null;
  const code = text.slice(prefix.length).trim();
  return isTripCode(code) ? code : null;
}
