# museum-cdn

A small Cloudflare Worker (`benadams-museum-cdn`) that serves the homepage museum's Godot web build
(wasm ~39.5 MB, pck ~11.9 MB, js, worklets, one song, posters) out of the R2 bucket `benadams-museum`.
The binaries stay out of git and off Vercel.

Live at `https://benadams-museum-cdn.scrandle-worker.workers.dev` (the account's workers.dev subdomain).
The page loads the engine from `https://benadams-museum-cdn.scrandle-worker.workers.dev/museum/<v>/museum`,
where `<v>` is the export hash in `app/components/museum/engineManifest.json`.

## What it does

- `GET`/`HEAD`/`OPTIONS` on `/museum/<v>/<file>` only; anything else is 404 (405 for other methods).
- `museum.wasm` is stored twice: `museum.wasm.br` (brotli q11, ~8 MB) and `museum.wasm` (plain). The Worker
  picks by `Accept-Encoding` and sends the stored bytes with `encodeBody: "manual"`, so Cloudflare does not
  re-encode. `museum.wasm.br` is not a public path. A `Range` request always gets the plain copy (ranges address decoded bytes).
- Headers: `Cache-Control: public, max-age=31536000, immutable`, `Content-Type`, `Content-Length`, `ETag`,
  `Vary: Origin, Accept-Encoding`, `Timing-Allow-Origin`, `Accept-Ranges`, 304 on `If-None-Match`.
- CORS reflects the origin only for `https://benadams.dev`, `https://www.benadams.dev`, `https://*.vercel.app`,
  `http://localhost[:port]` and `http://192.168.x.x[:port]`.
- No Cache API: it does not cache on workers.dev, and R2 reads stay far inside the free limits. Browsers cache forever anyway (immutable, versioned by `<v>`).

## Free-tier math

Worker: 100k requests/day free. Each visit costs about 8 requests (js, wasm, pck, worklets, one song, posters), so
roughly 12k visits/day. R2: 10 GB storage free; one version is about 62 MB raw (plus 8 MB br), so ~100 versions fit.
Reads: 10M Class B/month free (1-2 R2 reads per request: a `head` and a `get`). Egress from R2 is free.
Delete old versions occasionally: `npx wrangler r2 object delete benadams-museum/museum/<v>/<file> --remote`.

## Upload and deploy

```bash
# from the repo root, after museum-export.mjs has written the new engineManifest.json
node scripts/museum-upload.mjs        # or: node scripts/museum-export.mjs --upload
node scripts/museum-upload.mjs --force  # re-put everything

cd museum-cdn && npm install && npm run deploy   # Worker changes only
```

The upload script uses `wrangler r2 object put --remote` (it can set Content-Encoding and Cache-Control, so no S3 API
credentials are needed) and skips files whose size and ETag (md5) already match what the Worker serves. The brotli
copy of the wasm is cached in the OS temp dir per `<v>`. Wrangler must be logged in (`wrangler login`).
`MUSEUM_CDN_URL` overrides the Worker URL used for the idempotency check.

## Moving to a custom domain

benadams.dev's DNS is at Google Domains, so R2 custom domains and Worker routes are unavailable. If DNS moves to
Cloudflare, add `routes = [{ pattern = "museum.benadams.dev", custom_domain = true }]` to `wrangler.toml`, redeploy,
and change the page's base URL. No bucket changes are needed; add the new origin to `ALLOWED_ORIGIN` only if the page moves.
