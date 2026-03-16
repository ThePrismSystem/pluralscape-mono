import {
  BlobAlreadyExistsError,
  BlobNotFoundError,
  BlobTooLargeError,
  StorageBackendError,
} from "../../errors.js";

/**
 * Maps AWS SDK error names to storage-layer errors.
 * Throws the appropriate typed error or wraps unknown errors in StorageBackendError.
 */
export function mapS3Error(err: unknown, storageKey: string): never {
  if (!(err instanceof Error)) {
    throw new StorageBackendError("Unknown S3 error", { cause: err });
  }

  switch (err.name) {
    case "NoSuchKey":
    case "NotFound":
      throw new BlobNotFoundError(storageKey, { cause: err });

    case "EntityTooLarge":
      // S3 does not provide actual/max sizes in the error — use -1 as sentinel
      throw new BlobTooLargeError(-1, -1, { cause: err });

    case "PreconditionFailed":
      throw new BlobAlreadyExistsError(storageKey, { cause: err });

    default:
      throw new StorageBackendError(`S3 error: ${err.message}`, { cause: err });
  }
}
