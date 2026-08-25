import { RIVER } from "./config";

/**
 * The local link, in one place, so the strip that fires it on load and the
 * button somebody presses cannot disagree about its shape.
 *
 * `mfrs://join/CODE` is `Link.link_for()` in the game. The code goes here and
 * nowhere else: never into a network call, never into markup unescaped. The
 * game re-checks it on arrival through `Link.code_from()` and refuses an
 * address, a flag or a path traversal whatever this page believed.
 */
export function tripUri(code: string): string {
  return `${RIVER.scheme}://join/${code}`;
}

/** Hand the trip to an installed copy. Only ever called in the browser. */
export function openTrip(code: string): void {
  window.location.href = tripUri(code);
}
