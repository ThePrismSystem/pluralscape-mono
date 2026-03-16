import type { EncryptedPayload, StreamEncryptedPayload } from "../symmetric.js";
import type { BucketId } from "@pluralscape/types";

/** Metadata about the encryption applied to a blob. */
export interface BlobEncryptionMetadata {
  /** Which encryption tier was used. */
  readonly tier: 1 | 2;
  /** The algorithm used. Always "xchacha20-poly1305". */
  readonly algorithm: "xchacha20-poly1305";
  /** Bucket ID for T2 encryption. Null for T1. */
  readonly bucketId: BucketId | null;
  /** Whether streaming encryption was used (for large blobs). */
  readonly streamed: boolean;
}

/** Result of encrypting a blob. */
export interface EncryptedBlobResult {
  /** The encrypted bytes to store. */
  readonly encryptedData: Uint8Array;
  /** Encryption metadata for the DB record. */
  readonly metadata: BlobEncryptionMetadata;
  /** The raw encrypted payload (for serialization). */
  readonly payload: EncryptedPayload | StreamEncryptedPayload;
}
