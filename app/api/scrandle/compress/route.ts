import sharp from "sharp";
import { readSignedPayload } from "../_lib/signing";

/**
 * A web-sized copy of a photograph, for the Scrandle Worker to store in place
 * of the original — see scrandle-worker/src/compress.ts.
 *
 * The bucket used to keep every photograph as the phone made it, about four
 * megabytes each, and nothing shows one at that size. The Worker cannot shrink
 * them itself on ten milliseconds of CPU, so it asks here, with a signed URL
 * like every other render, and writes what comes back over the original.
 *
 * What comes back is permanent, so this is deliberately generous: the long
 * edge at 1600 is well past anything the cards or the weekly game draw at, and
 * quality 80 is not visibly different from the original at that size. The
 * EXIF orientation is applied before the metadata is dropped — and the
 * metadata being dropped is a feature, since a phone photograph carries where
 * it was taken.
 *
 * A PNG comes back as a JPEG too, flattened onto white. The ones in the
 * catalog are photographs and screenshots, not artwork with a use for
 * transparency.
 */

interface CompressPayload {
  /** The photograph to shrink */
  u: string;
}

const MAX_EDGE = 1600;

/** A big original is a slow download before it is a slow encode. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const result = await readSignedPayload<CompressPayload>(new URL(request.url));
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  try {
    const source = await fetch(result.payload.u);
    if (!source.ok) {
      return new Response(`Source answered ${source.status}`, { status: 502 });
    }

    const bytes = await sharp(Buffer.from(await source.arrayBuffer()), {
      failOn: "none",
    })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/jpeg",
        // Asked for once, by the Worker, and the answer goes into the bucket.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return new Response(`Could not compress: ${String(error)}`, { status: 502 });
  }
}
