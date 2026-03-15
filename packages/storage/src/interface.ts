import type { UnixMillis } from "@pluralscape/types";

/**
 * Parameters for uploading a blob to storage.
 *
 * The `data` field contains already-encrypted bytes — the storage layer
 * is zero-knowledge and never sees plaintext.
 */
export interface BlobUploadParams {
  readonly storageKey: string;
  /** Encrypted blob bytes. */
  readonly data: Uint8Array;
  readonly mimeType: string | null;
  /** SHA-256 hex digest of the encrypted bytes (64 chars). */
  readonly checksum: string;
}

/**
 * Metadata that the storage backend records about a stored blob.
 *
 * Intentionally excludes domain fields (systemId, purpose, encryptionTier, bucketId)
 * that belong to the DB layer's blob_metadata table.
 */
export interface StoredBlobMetadata {
  readonly storageKey: string;
  readonly sizeBytes: number;
  readonly mimeType: string | null;
  /** SHA-256 hex digest of the stored bytes (64 chars). */
  readonly checksum: string;
  readonly uploadedAt: UnixMillis;
}

/** Parameters for generating a presigned upload URL. */
export interface PresignedUploadParams {
  readonly storageKey: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number;
  /** Validity window in milliseconds. Defaults to backend-specific value if omitted. */
  readonly expiresInMs?: number;
}

/** Parameters for generating a presigned download URL. */
export interface PresignedDownloadParams {
  readonly storageKey: string;
  /** Validity window in milliseconds. Defaults to backend-specific value if omitted. */
  readonly expiresInMs?: number;
}

/**
 * Result of a presigned URL request.
 *
 * Callers must check `supported` before using the URL — filesystem adapters
 * return `{ supported: false }` since they have no concept of presigned URLs.
 */
export type PresignedUrlResult =
  | { readonly supported: true; readonly url: string; readonly expiresAt: UnixMillis }
  | { readonly supported: false };

/**
 * Platform-agnostic blob storage adapter.
 *
 * All bytes stored and retrieved are encrypted — the adapter is zero-knowledge.
 * Implementations must be idempotent where noted and never throw on benign conditions.
 *
 * Implementations: S3 (cloud), MinIO (self-hosted), filesystem (local dev / offline).
 */
export interface BlobStorageAdapter {
  /**
   * Stores encrypted blob bytes under the given storage key.
   *
   * Throws BlobAlreadyExistsError if a blob already exists at this key.
   * Throws BlobTooLargeError if the data exceeds the adapter's size limit.
   */
  upload(params: BlobUploadParams): Promise<StoredBlobMetadata>;

  /**
   * Downloads encrypted blob bytes by storage key.
   * Throws BlobNotFoundError if no blob exists at this key.
   */
  download(storageKey: string): Promise<Uint8Array>;

  /**
   * Deletes a blob by storage key.
   * Idempotent — does not throw if the key does not exist.
   */
  delete(storageKey: string): Promise<void>;

  /**
   * Returns true if a blob exists at the given key, false otherwise.
   */
  exists(storageKey: string): Promise<boolean>;

  /**
   * Returns metadata for a blob, or null if no blob exists at this key.
   */
  getMetadata(storageKey: string): Promise<StoredBlobMetadata | null>;

  /**
   * Generates a presigned URL for a direct client-to-storage upload.
   *
   * Returns `{ supported: false }` on adapters that do not support presigned URLs
   * (e.g., filesystem adapter). Callers must fall back to proxied upload in that case.
   */
  generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUrlResult>;

  /**
   * Generates a presigned URL for a direct client-to-storage download.
   *
   * Returns `{ supported: false }` on adapters that do not support presigned URLs.
   */
  generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<PresignedUrlResult>;

  /**
   * True if this adapter can produce presigned URLs; false for filesystem adapters.
   * The API layer uses this to choose between presigned-URL and proxied upload flows.
   */
  readonly supportsPresignedUrls: boolean;
}
