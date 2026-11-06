/**
 * Serves /museum/<v>/<file> out of the benadams-museum R2 bucket.
 *
 * museum.wasm is stored twice: brotli-precompressed (museum.wasm.br, served with
 * Content-Encoding: br when the client accepts it) and plain (museum.wasm). Everything
 * else is stored as-is. Objects are immutable per <v> (a content hash), so they cache forever.
 */

interface Env {
  BUCKET: R2Bucket;
}

const TYPES: Record<string, string> = {
  wasm: "application/wasm",
  pck: "application/octet-stream",
  js: "text/javascript",
  mp3: "audio/mpeg",
  webp: "image/webp",
  ogv: "video/ogg",
};

// A file at the top of the export, one of the songs (songs/<id>.mp3) or an exhibit video (videos/<id>.ogv).
const PATH = /^\/museum\/([A-Za-z0-9]{6,32})\/(songs\/[a-z0-9-]+\.mp3|videos\/[a-z0-9-]+\.ogv|[A-Za-z0-9._-]+)$/;

const ALLOWED_ORIGIN =
  /^(https:\/\/(www\.)?benadams\.dev|https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app|http:\/\/localhost(:\d+)?|http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?)$/;

function corsHeaders(origin: string | null): Headers {
  const h = new Headers();
  h.set("Vary", "Origin, Accept-Encoding");
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Timing-Allow-Origin", origin);
  }
  h.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Encoding, ETag, Accept-Ranges");
  h.set("Cross-Origin-Resource-Policy", "cross-origin");
  return h;
}

function plain(status: number, body: string, headers: Headers): Response {
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(body, { status, headers });
}

/** One byte range of a known size, or null (ignore) / "bad" (416). */
function parseRange(header: string, size: number): { offset: number; length: number } | "bad" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (n === 0) return "bad";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "bad";
  return { offset: start, length: end - start + 1 };
}

export default {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Range, If-None-Match, If-Match, If-Range");
      headers.set("Access-Control-Max-Age", "86400");
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers.set("Allow", "GET, HEAD, OPTIONS");
      return plain(405, "Method not allowed", headers);
    }

    const url = new URL(request.url);
    const match = PATH.exec(url.pathname);
    if (!match) return plain(404, "Not found", headers);
    const [, version, file] = match;
    const ext = file.slice(file.lastIndexOf(".") + 1);
    const type = TYPES[ext];
    // The stored brotli copy is an implementation detail, not a public path.
    if (!type || file.endsWith(".wasm.br")) return plain(404, "Not found", headers);

    const rangeHeader = request.headers.get("Range");
    let key = `museum/${version}/${file}`;
    let encoded = false;
    // Cloudflare normalises the Accept-Encoding it forwards, so the client's own is cf.clientAcceptEncoding.
    // Ranges address the decoded bytes, so a Range request always takes the plain copy.
    if (file === "museum.wasm" && !rangeHeader && /\bbr\b/.test(request.cf?.clientAcceptEncoding ?? request.headers.get("Accept-Encoding") ?? "")) {
      key += ".br";
      encoded = true;
    }

    const head = await env.BUCKET.head(key);
    if (!head) return plain(404, "Not found", headers);

    headers.set("Content-Type", type);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", encoded ? "none" : "bytes");
    headers.set("ETag", head.httpEtag);
    if (encoded) headers.set("Content-Encoding", "br");

    const inm = request.headers.get("If-None-Match");
    if (inm && (inm === "*" || inm.split(",").some((t) => t.trim().replace(/^W\//, "") === head.httpEtag))) {
      return new Response(null, { status: 304, headers });
    }

    let status = 200;
    let range: { offset: number; length: number } | undefined;
    if (rangeHeader && !encoded) {
      const ifRange = request.headers.get("If-Range");
      if (!ifRange || ifRange === head.httpEtag) {
        const parsed = parseRange(rangeHeader, head.size);
        if (parsed === "bad") {
          headers.set("Content-Range", `bytes */${head.size}`);
          return new Response(null, { status: 416, headers });
        }
        if (parsed) {
          range = parsed;
          status = 206;
          headers.set("Content-Range", `bytes ${parsed.offset}-${parsed.offset + parsed.length - 1}/${head.size}`);
        }
      }
    }
    headers.set("Content-Length", String(range ? range.length : head.size));

    // encodeBody: "manual" keeps Cloudflare from re-encoding (or dropping Content-Length on) the body.
    if (request.method === "HEAD") return new Response(null, { status, headers, encodeBody: "manual" });

    const object = await env.BUCKET.get(key, range ? { range, onlyIf: { etagMatches: head.etag } } : { onlyIf: { etagMatches: head.etag } });
    if (!object || !("body" in object)) return plain(404, "Not found", corsHeaders(origin));
    return new Response(object.body, { status, headers, encodeBody: "manual" });
  },
} satisfies ExportedHandler<Env>;
