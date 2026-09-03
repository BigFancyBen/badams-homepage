import { readSignedPayload, type PayloadResult } from "../../scrandle/_lib/signing";

/**
 * Yut Hut's render routes share Scrandle's URL-signing scheme
 * (`?d=<base64url json>&s=<hmac>`) but not its key. The Worker side lives in
 * yut-worker and must stay byte-compatible with scrandle-worker's signer.
 */
export function readYutPayload<T>(url: URL): Promise<PayloadResult<T>> {
  return readSignedPayload<T>(url, process.env.YUT_IMAGE_SECRET);
}
