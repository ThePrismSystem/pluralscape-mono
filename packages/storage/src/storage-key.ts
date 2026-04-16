import { brandId } from "@pluralscape/types";

import type { BlobId, StorageKey, SystemId } from "@pluralscape/types";

/**
 * Generates a storage key for a blob.
 *
 * Format: `{systemId}/{blobId}` — ensures blobs are partitioned by system,
 * preventing key collisions between systems and enabling prefix-based access control.
 */
export function generateStorageKey(systemId: SystemId, blobId: BlobId): StorageKey {
  return brandId<StorageKey>(`${systemId}/${blobId}`);
}

/**
 * Parses a storage key into its component parts.
 * Returns null if the key does not match the expected `{systemId}/{blobId}` format.
 */
export function parseStorageKey(key: string): { systemId: SystemId; blobId: BlobId } | null {
  const slashIndex = key.indexOf("/");
  if (slashIndex <= 0 || slashIndex === key.length - 1) {
    return null;
  }
  return {
    systemId: brandId<SystemId>(key.slice(0, slashIndex)),
    blobId: brandId<BlobId>(key.slice(slashIndex + 1)),
  };
}
