import type { BlobId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** Encryption tier for stored blobs: 1 = at-rest only, 2 = at-rest + per-bucket key. */
export type EncryptionTier = 1 | 2;

/** The intended purpose of a blob. */
export type BlobPurpose =
  | "avatar"
  | "member-photo"
  | "journal-image"
  | "attachment"
  | "export"
  | "littles-safe-mode";

/**
 * Metadata about a stored blob.
 *
 * Intentionally omits AuditMetadata -- blobs are immutable after upload.
 * They are only created or deleted, never updated. Only uploadedAt is tracked.
 */
export interface BlobMetadata {
  readonly id: BlobId;
  readonly systemId: SystemId;
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly uploadedAt: UnixMillis;
  /** Links this blob as a thumbnail of another blob. Null if not a thumbnail. */
  readonly thumbnailOfBlobId: BlobId | null;
}

/** A request to upload a blob. */
export interface BlobUploadRequest {
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** A reference for downloading a blob. */
export interface BlobDownloadRef {
  readonly blobId: BlobId;
  readonly url: string;
  readonly expiresAt: UnixMillis;
}
