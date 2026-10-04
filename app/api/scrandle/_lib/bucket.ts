/** The Scrandle Worker's public bucket: the photographs and the weekly puzzle. */
export const BUCKET_BASE = "https://pub-b7525558c8974aa0aa1f10bf9856eb18.r2.dev";

/** A photograph's object name: the sha256 the Worker stored it under. */
export const PLATE_FILE = /^[a-f0-9]{64}\.(?:jpe?g|png)$/;

const DISHES = `${BUCKET_BASE}/dishes/`;

/**
 * Where the weekly game loads a photograph from: the site's own resized copy
 * (see ../plate/[file]/route.ts) when it is one of the bucket's, and the
 * address as given otherwise, which only happens against a local fixture.
 */
export function plateSrc(image: string): string {
  const file = image.startsWith(DISHES) ? image.slice(DISHES.length) : "";
  return PLATE_FILE.test(file) ? `/api/scrandle/plate/${file}` : image;
}
