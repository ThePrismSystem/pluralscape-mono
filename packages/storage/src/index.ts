// @pluralscape/storage — backend-agnostic blob storage adapter interface

// ── Interface & types ────────────────────────────────────────────────
export type {
  BlobStorageAdapter,
  BlobUploadParams,
  PresignedDownloadParams,
  PresignedUploadParams,
  PresignedUrlResult,
  StoredBlobMetadata,
} from "./interface.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  BlobAlreadyExistsError,
  BlobNotFoundError,
  BlobTooLargeError,
  QuotaExceededError,
  StorageBackendError,
} from "./errors.js";

// ── Storage key utilities ────────────────────────────────────────────
export { generateStorageKey, parseStorageKey } from "./storage-key.js";
