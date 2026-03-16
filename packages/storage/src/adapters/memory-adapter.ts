import { now } from "@pluralscape/types/runtime";

import { BlobAlreadyExistsError, BlobNotFoundError, BlobTooLargeError } from "../errors.js";

import type {
  BlobStorageAdapter,
  BlobUploadParams,
  PresignedUrlResult,
  StoredBlobMetadata,
} from "../interface.js";
import type { StorageKey } from "@pluralscape/types";

interface StoredEntry {
  data: Uint8Array;
  metadata: StoredBlobMetadata;
}

/**
 * In-memory implementation of BlobStorageAdapter for use in contract tests.
 *
 * Stores blobs in a Map keyed by storageKey. Does not support presigned URLs.
 */
export class MemoryBlobStorageAdapter implements BlobStorageAdapter {
  readonly supportsPresignedUrls = false as const;

  private readonly store = new Map<StorageKey, StoredEntry>();
  private readonly maxSizeBytes: number | null;

  constructor({ maxSizeBytes }: { maxSizeBytes?: number } = {}) {
    this.maxSizeBytes = maxSizeBytes ?? null;
  }

  upload(params: BlobUploadParams): Promise<StoredBlobMetadata> {
    if (this.store.has(params.storageKey)) {
      return Promise.reject(new BlobAlreadyExistsError(params.storageKey));
    }
    if (this.maxSizeBytes !== null && params.data.byteLength > this.maxSizeBytes) {
      return Promise.reject(new BlobTooLargeError(params.data.byteLength, this.maxSizeBytes));
    }
    const metadata: StoredBlobMetadata = {
      storageKey: params.storageKey,
      sizeBytes: params.data.byteLength,
      mimeType: params.mimeType,
      checksum: params.checksum,
      uploadedAt: now(),
    };
    this.store.set(params.storageKey, { data: new Uint8Array(params.data), metadata });
    return Promise.resolve(metadata);
  }

  download(storageKey: StorageKey): Promise<Uint8Array> {
    const entry = this.store.get(storageKey);
    if (entry === undefined) return Promise.reject(new BlobNotFoundError(storageKey));
    return Promise.resolve(new Uint8Array(entry.data));
  }

  delete(storageKey: StorageKey): Promise<void> {
    this.store.delete(storageKey);
    return Promise.resolve();
  }

  exists(storageKey: StorageKey): Promise<boolean> {
    return Promise.resolve(this.store.has(storageKey));
  }

  getMetadata(storageKey: StorageKey): Promise<StoredBlobMetadata | null> {
    return Promise.resolve(this.store.get(storageKey)?.metadata ?? null);
  }

  generatePresignedUploadUrl(): Promise<PresignedUrlResult> {
    return Promise.resolve({ supported: false } as const);
  }

  generatePresignedDownloadUrl(): Promise<PresignedUrlResult> {
    return Promise.resolve({ supported: false } as const);
  }
}
