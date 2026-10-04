import sharp from "sharp";
import { BUCKET_BASE, PLATE_FILE } from "../../_lib/bucket";

/**
 * One web-sized copy of a photograph from the Scrandle bucket, for the weekly
 * game at /scrandle/play.
 *
 * The originals are whatever the phone made — several megabytes each — so the
 * page cannot show them as they are. Next's image optimizer would resize them,
 * but it makes a separate copy for every screen width that asks, and each copy
 * counts against a monthly allowance that the whole site shares and that
 * breaks images everywhere when it runs out. Twenty photographs a puzzle at
 * five or six widths apiece was a tenth of that allowance a month.
 *
 * So this makes exactly one copy per photograph, the same for every screen,
 * and tells the CDN to keep it for a year. The address is the photograph's
 * hash, so the copy can never go stale, and the tile and the thumbnail on the
 * score screen are the same file — the browser fetches it once. The crop is
 * left to the page, which already places the frame on the focal point in CSS;
 * baking it in here would make the copy depend on a number, and one copy per
 * photograph is the whole point.
 *
 * Only a name that looks like one of the bucket's own photographs is fetched,
 * so this cannot be pointed at anything else.
 */

/** Twice the widest tile, for a dense screen. */
const MAX_EDGE = 960;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!PLATE_FILE.test(file)) {
    return new Response("Not a plate", { status: 404 });
  }

  try {
    const source = await fetch(`${BUCKET_BASE}/dishes/${file}`);
    if (!source.ok) return new Response("Not found", { status: 404 });

    // `rotate()` with no angle applies the EXIF orientation, which is how a
    // phone records a portrait photograph in the first place.
    const bytes = await sharp(Buffer.from(await source.arrayBuffer()), {
      failOn: "none",
    })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/jpeg",
        // `s-maxage` is the one Vercel's CDN reads; without it only the
        // browser caches, and every new visitor runs the resize again.
        "cache-control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("Could not resize", { status: 502 });
  }
}
