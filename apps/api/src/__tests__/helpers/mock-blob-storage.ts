import { createQuotaService } from "@pluralscape/storage/quota";
import { toUnixMillis } from "@pluralscape/types";
import { vi } from "vitest";

import type {
  BlobStorageAdapter,
  BlobUploadParams,
  PresignedDownloadParams,
  PresignedUploadParams,
  PresignedUrlResult,
  StoredBlobMetadata,
} from "@pluralscape/storage";
import type { BlobQuotaService } from "@pluralscape/storage/quota";
import type { StorageKey } from "@pluralscape/types";

/** Presigned URL validity window used in mock responses (1 hour). */
const MOCK_PRESIGNED_TTL_MS = 3_600_000;

/**
 * In-memory mock of BlobStorageAdapter.
 *
 * Tracks uploads in a Map so tests can verify storage interactions.
 * All presigned URLs point to `https://mock-s3.test/`.
 */
export function createMockBlobStorage(): BlobStorageAdapter & {
  blobs: Map<StorageKey, StoredBlobMetadata>;
} {
  const blobs = new Map<StorageKey, StoredBlobMetadata>();

  return {
    blobs,

    upload: vi.fn((params: BlobUploadParams): Promise<StoredBlobMetadata> => {
      const meta: StoredBlobMetadata = {
        storageKey: params.storageKey,
        sizeBytes: params.data.byteLength,
        mimeType: params.mimeType,
        checksum: params.checksum,
        uploadedAt: toUnixMillis(Date.now()),
      };
      blobs.set(params.storageKey, meta);
      return Promise.resolve(meta);
    }),

    download: vi.fn((storageKey: StorageKey): Promise<Uint8Array> => {
      const meta = blobs.get(storageKey);
      if (!meta) return Promise.reject(new Error(`Blob not found: ${storageKey}`));
      return Promise.resolve(new Uint8Array(meta.sizeBytes));
    }),

    delete: vi.fn((storageKey: StorageKey): Promise<void> => {
      blobs.delete(storageKey);
      return Promise.resolve();
    }),

    exists: vi.fn((storageKey: StorageKey): Promise<boolean> => {
      return Promise.resolve(blobs.has(storageKey));
    }),

    getMetadata: vi.fn((storageKey: StorageKey): Promise<StoredBlobMetadata | null> => {
      return Promise.resolve(blobs.get(storageKey) ?? null);
    }),

    generatePresignedUploadUrl: vi.fn(
      (params: PresignedUploadParams): Promise<PresignedUrlResult> =>
        Promise.resolve({
          supported: true,
          url: `https://mock-s3.test/upload/${params.storageKey}`,
          expiresAt: toUnixMillis(Date.now() + MOCK_PRESIGNED_TTL_MS),
        }),
    ),

    generatePresignedDownloadUrl: vi.fn(
      (params: PresignedDownloadParams): Promise<PresignedUrlResult> =>
        Promise.resolve({
          supported: true,
          url: `https://mock-s3.test/download/${params.storageKey}`,
          expiresAt: toUnixMillis(Date.now() + MOCK_PRESIGNED_TTL_MS),
        }),
    ),

    supportsPresignedUrls: true,
  };
}

/**
 * Creates a real BlobQuotaService backed by a mock usage query.
 *
 * Call `rejectNext()` to make the next `assertQuota` fail (by reporting
 * usage at 100% of quota).
 */
export function createMockBlobQuota(): BlobQuotaService & {
  rejectNext: () => void;
} {
  let shouldReject = false;

  const mockUsageQuery = {
    getUsedBytes: vi.fn((): Promise<number> => {
      if (shouldReject) {
        shouldReject = false;
        // Return usage exceeding quota to trigger rejection
        return Promise.resolve(2_000_000_000);
      }
      return Promise.resolve(0);
    }),
  };

  const service = createQuotaService(mockUsageQuery);

  return Object.assign(service, {
    rejectNext: () => {
      shouldReject = true;
    },
  });
}
