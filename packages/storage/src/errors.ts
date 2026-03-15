/**
 * Thrown when download() or getMetadata() is called for a storage key that does not exist.
 */
export class BlobNotFoundError extends Error {
  override readonly name = "BlobNotFoundError" as const;
  readonly storageKey: string;

  constructor(storageKey: string, options?: ErrorOptions) {
    super(`Blob not found at storage key "${storageKey}".`, options);
    this.storageKey = storageKey;
  }
}

/**
 * Thrown when upload() is called with a storage key that already has a blob stored at it.
 * Callers must delete the existing blob before re-uploading to the same key.
 */
export class BlobAlreadyExistsError extends Error {
  override readonly name = "BlobAlreadyExistsError" as const;
  readonly storageKey: string;

  constructor(storageKey: string, options?: ErrorOptions) {
    super(`A blob already exists at storage key "${storageKey}".`, options);
    this.storageKey = storageKey;
  }
}

/**
 * Thrown when the uploaded data exceeds the adapter's maximum allowed size.
 */
export class BlobTooLargeError extends Error {
  override readonly name = "BlobTooLargeError" as const;
  readonly sizeBytes: number;
  readonly maxSizeBytes: number;

  constructor(sizeBytes: number, maxSizeBytes: number, options?: ErrorOptions) {
    super(
      `Blob size ${String(sizeBytes)} bytes exceeds maximum allowed size of ${String(maxSizeBytes)} bytes.`,
      options,
    );
    this.sizeBytes = sizeBytes;
    this.maxSizeBytes = maxSizeBytes;
  }
}

/**
 * Thrown when the storage backend encounters an unexpected error.
 */
export class StorageBackendError extends Error {
  override readonly name = "StorageBackendError" as const;
}
