import manifest from "./engineManifest.json";

/** Changes with every export (scripts/museum-export.mjs writes engineManifest.json). The engine
    files live under `museum/<this>/` on the CDN and are cached as immutable, so a new export is
    picked up and an old one is never revalidated. */
export const ENGINE_VERSION: string = manifest.v;

/** The game files (about 18 MB) are served from Cloudflare R2 through a small Worker
    (museum-cdn/), not from this site, so they stay out of git and off the site's bandwidth.
    Upload a new export with `node scripts/museum-upload.mjs`. NEXT_PUBLIC_MUSEUM_CDN overrides it,
    e.g. for a custom domain later. */
export const MUSEUM_CDN: string =
  process.env.NEXT_PUBLIC_MUSEUM_CDN ?? "https://benadams-museum-cdn.scrandle-worker.workers.dev";
const CDN_DIR = `${MUSEUM_CDN}/museum/${ENGINE_VERSION}`;
/** The mp3 of one of the house songs (see songs.ts), under songs/ on the CDN. */
export const songUrl = (id: string): string => `${CDN_DIR}/songs/${id}.mp3`;

export const ENGINE_BASE = `${CDN_DIR}/museum`;
export const ENGINE_SCRIPT = `${ENGINE_BASE}.js?v=${ENGINE_VERSION}`;
/** Decoded sizes of the two large files (what the loader receives), for the loading bar. */
export const ENGINE_BYTES_TOTAL: number = Object.values(manifest.bytes).reduce((a, b) => a + b, 0);

/** Rough size of museum.js + .wasm + .pck as sent (compressed), shown next to the Enter button. */
export const DOWNLOAD_MB: number = manifest.downloadMb;
