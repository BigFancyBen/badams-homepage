import sharp from "sharp";

/**
 * Where the subject of a photograph sits, as fractions of its width and
 * height — `[0.5, 0.5]` is dead centre. The Worker's classifier writes one
 * for every dish; see scrandle-worker/src/classify.ts.
 */
export type Focus = [number, number];

/** Rejects anything that is not a pair of finite numbers inside the frame. */
function validFocus(focus: unknown): focus is Focus {
  return (
    Array.isArray(focus) &&
    focus.length === 2 &&
    focus.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1
    )
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fetches a photograph and hands back exactly the `width` × `height` piece of
 * it a card should show, as a data URL satori can draw as-is.
 *
 * The cards used to hand satori the full photograph with `object-fit: cover`,
 * and satori always takes the middle: it accepts `object-position` and then
 * ignores it, so a tall phone photo of a plate on a table showed the table
 * and lost the plate. The crop is done here instead, with sharp, before
 * satori ever sees the image.
 *
 * With a focal point the crop is the largest window of the tile's shape that
 * fits in the photograph, slid so the focal point is as near its centre as
 * the edges allow. Without one — a photograph the classifier has not been
 * round again for yet — sharp's attention crop stands in: it scores regions
 * on detail, saturation and skin, which is a fair guess at where the food is
 * and a better one than the middle.
 *
 * Anything going wrong falls back to the original URL and the old behaviour,
 * so a broken fetch here costs a worse crop rather than a card with a hole in
 * it. Handing satori a tile-sized JPEG rather than a multi-megapixel original
 * also takes most of the rasterizing cost out of the render.
 */
export async function cropTo(
  src: string,
  width: number,
  height: number,
  focus?: unknown
): Promise<string> {
  try {
    const response = await fetch(src);
    if (!response.ok) return src;
    const input = Buffer.from(await response.arrayBuffer());

    // `rotate()` with no angle applies the EXIF orientation, which is how a
    // phone records a portrait photograph in the first place.
    const image = sharp(input, { failOn: "none" }).rotate();
    let tile: sharp.Sharp;

    if (validFocus(focus)) {
      const meta = await image.metadata();
      const iw = meta.autoOrient?.width ?? meta.width;
      const ih = meta.autoOrient?.height ?? meta.height;
      if (!iw || !ih) return src;

      const scale = Math.max(width / iw, height / ih);
      const cropWidth = Math.min(iw, Math.round(width / scale));
      const cropHeight = Math.min(ih, Math.round(height / scale));
      const left = clamp(
        Math.round(focus[0] * iw - cropWidth / 2),
        0,
        iw - cropWidth
      );
      const top = clamp(
        Math.round(focus[1] * ih - cropHeight / 2),
        0,
        ih - cropHeight
      );

      tile = image
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize(width, height);
    } else {
      tile = image.resize(width, height, {
        fit: "cover",
        position: sharp.strategy.attention,
      });
    }

    const bytes = await tile.jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return src;
  }
}
