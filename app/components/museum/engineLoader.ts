import { ENGINE_BASE, ENGINE_VERSION } from "./constants";

/**
 * The two large engine files (museum.wasm, museum.pck) go through here instead of straight through
 * Godot's loader, for two reasons.
 *
 * 1. Godot retries a download only if fetch() itself fails. A connection that drops, or a browser
 *    cache write that fails (Chrome's net::ERR_CACHE_WRITE_FAILURE, which it raises mid-body when
 *    the cache entry for a 40 MB response cannot be written), breaks the response while it is being
 *    read; Godot never notices, and the load just hangs. Here a broken download is started again
 *    (without the HTTP cache) and the bytes the loader already has are skipped, so it sees one
 *    unbroken stream. Only when the retries run out does it fail, and then it says so.
 * 2. It reports how many bytes have arrived, which Godot's loader can only do when it is told every
 *    file's size up front.
 *
 * The files are requested as `?v=<export hash>` (see constants.ts), which is what lets the server
 * cache them as immutable.
 *
 * They are also kept in Cache Storage ("museum-engine-<version>"), which unlike the HTTP cache is
 * not evicted for being large and is not subject to its write failures. A return visit reads them
 * from there with no request at all, and other versions' caches are deleted. No
 * navigator.storage.persist(): Firefox turns that into a permission prompt, and an evicted cache
 * only means downloading again.
 * Without the Cache API (insecure context) or on any error, it is the
 * network as before.
 */

const CACHE_PREFIX = "museum-engine-";
const CACHE_NAME = `${CACHE_PREFIX}${ENGINE_VERSION}`;

/** This version's cache, or null where Cache Storage is missing or refuses. Tidies as a side effect. */
let cachePromise: Promise<Cache | null> | null = null;
function openCache(): Promise<Cache | null> {
  cachePromise ??= (async () => {
    try {
      if (typeof caches === "undefined") return null;
      const cache = await caches.open(CACHE_NAME);
      void caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
        .catch(() => {});
      return cache;
    } catch {
      return null;
    }
  })();
  return cachePromise;
}

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 700, 1500, 3000, 5000];

export interface EngineFetchHooks {
  /** `received` is the total decoded bytes of `file` handed to the loader so far. */
  onBytes(file: string, received: number): void;
  /** The download failed for good. */
  onFatal(err: unknown): void;
}

class HttpError extends Error {
  readonly permanent: boolean;
  constructor(file: string, status: number) {
    super(`${file}: HTTP ${status}`);
    this.permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pathOf(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    /* Origin and path, no query: the engine files come from the CDN's origin, not this one. */
    const u = new URL(raw, window.location.href);
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

/**
 * Routes the engine's own requests for its .wasm and .pck through the resilient loader below.
 * Returns the function that puts window.fetch back; call it once the engine has started.
 */
export function installEngineFetch(hooks: EngineFetchHooks): () => void {
  const real = window.fetch.bind(window);
  const mine = new Set([`${ENGINE_BASE}.wasm`, `${ENGINE_BASE}.pck`].map((p) => pathOf(p)));
  const patched: typeof window.fetch = (input, init) => {
    const path = pathOf(input);
    if (path && mine.has(path)) return resilientFetch(real, path, hooks);
    return real(input, init);
  };
  window.fetch = patched;
  return () => {
    if (window.fetch === patched) window.fetch = real;
  };
}

async function resilientFetch(real: typeof window.fetch, path: string, hooks: EngineFetchHooks): Promise<Response> {
  const url = `${path}?v=${ENGINE_VERSION}`;
  const file = path.split("/").pop() ?? path;
  let attempt = 0;
  let received = 0;
  let skip = 0;
  let contentType: string | null = null;

  /* One good response, trying again a few times. The first try may use the HTTP cache; every one
     after a failure goes around it. */
  async function open(): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    for (;;) {
      try {
        if (attempt === 0) {
          const cache = await openCache();
          const hit = await cache?.match(url).catch(() => undefined);
          if (hit?.ok && hit.body) {
            contentType ??= hit.headers.get("content-type");
            return hit.body.getReader();
          }
        }
        const res = await real(url, { credentials: "same-origin", cache: attempt === 0 ? "default" : "no-store" });
        if (!res.ok || !res.body) throw new HttpError(file, res.status);
        contentType ??= res.headers.get("content-type");
        if (attempt === 0) {
          /* Stored as it streams in; a download that breaks leaves nothing behind. */
          const keep = res.clone();
          void openCache().then((cache) => cache?.put(url, keep)).catch(() => {});
        }
        return res.body.getReader();
      } catch (err) {
        /* A missing file will not turn up on a second try. */
        if (err instanceof HttpError && err.permanent) throw err;
        if (++attempt >= MAX_ATTEMPTS) throw err;
        console.warn(`[museum] ${file}: ${String(err)}; trying again`);
        await sleep(BACKOFF_MS[attempt] ?? 5000);
      }
    }
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = await open();
  } catch (err) {
    hooks.onFatal(err);
    throw err;
  }

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          let chunk = value;
          if (skip > 0) {
            if (chunk.length <= skip) {
              skip -= chunk.length;
              continue;
            }
            chunk = chunk.subarray(skip);
            skip = 0;
          }
          received += chunk.length;
          hooks.onBytes(file, received);
          controller.enqueue(chunk);
          return;
        } catch (err) {
          /* Broken mid-download: start over and skip what the loader already has. */
          console.warn(`[museum] ${file}: download broke after ${received} bytes (${String(err)}); trying again`);
          if (++attempt >= MAX_ATTEMPTS) {
            hooks.onFatal(err);
            controller.error(err);
            return;
          }
          await sleep(BACKOFF_MS[attempt] ?? 5000);
          try {
            reader = await open();
            skip = received;
          } catch (err2) {
            hooks.onFatal(err2);
            controller.error(err2);
            return;
          }
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  /* Decoded body: only the type is carried over (the encoded length would be wrong). */
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status: 200, headers });
}
