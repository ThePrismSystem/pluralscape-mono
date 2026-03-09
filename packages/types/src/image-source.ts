import type { BlobId } from "./ids.js";

/** A discriminated union for image sources — either a stored blob or an external URL. */
export type ImageSource =
  | { readonly kind: "blob"; readonly blobRef: BlobId }
  | { readonly kind: "external"; readonly url: string };
