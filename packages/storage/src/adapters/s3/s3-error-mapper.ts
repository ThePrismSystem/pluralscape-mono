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

  const name = (err as Error & { name: string }).name;

  switch (name) {
    case "NoSuchKey":
    case "NotFound":
      throw new BlobNotFoundError(storageKey, { cause: err });

    case "EntityTooLarge":
      throw new BlobTooLargeError(0, 0, { cause: err });

    case "BucketAlreadyOwnedByYou":
    case "ConditionalCheckFailedException":
      throw new BlobAlreadyExistsError(storageKey, { cause: err });

    default:
      throw new StorageBackendError(`S3 error: ${err.message}`, { cause: err });
  }
}
