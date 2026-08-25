/**
 * The two typefaces the game itself is set in — Archivo Narrow for words, IBM
 * Plex Mono for numbers and codes — loaded in `layout.tsx` and named here so a
 * class string that has to appear in a dozen places appears once.
 *
 * The game's own reason for them (README, `assets/fonts/`) holds on the web
 * too: the interface is meant to read as a USGS quadrangle sheet and a Forest
 * Service river permit, and a page set in the default UI font reads as a
 * default UI page no matter what else is done to it.
 */
export const MONO = "font-[family-name:var(--font-plex)]";
export const SANS = "font-[family-name:var(--font-archivo)]";
