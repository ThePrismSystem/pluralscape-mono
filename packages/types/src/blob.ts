import type { BlobId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** The intended purpose of a blob. */
export type BlobPurpose = "avatar" | "member-photo" | "journal-image" | "attachment" | "export";

/** Metadata about a stored blob. */
export interface BlobMetadata {
  readonly id: BlobId;
  readonly systemId: SystemId;
  readonly purpose: BlobPurpose;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly uploadedAt: UnixMillis;
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
