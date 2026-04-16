import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { now } from "@pluralscape/types/runtime";

import {
  BlobAlreadyExistsError,
  BlobNotFoundError,
  BlobTooLargeError,
  StorageBackendError,
} from "../../errors.js";

import type {
  BlobStorageAdapter,
  BlobUploadParams,
  PresignedUrlResult,
  StoredBlobMetadata,
} from "../../interface.js";
import type { Logger, StorageKey, UnixMillis } from "@pluralscape/types";

interface SidecarMetadata {
  mimeType: string | null;
  checksum: string;
  uploadedAt: UnixMillis;
}

const FILE_MODE = 0o600;

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/**
 * Filesystem-backed implementation of BlobStorageAdapter.
 *
 * Stores blobs as files under `{storageRoot}/{systemId}/{blobId}` with a
 * `.meta.json` sidecar for metadata. Uses atomic writes (temp file + rename)
 * to prevent partial files.
 */
export class FilesystemBlobStorageAdapter implements BlobStorageAdapter {
  readonly supportsPresignedUrls = false as const;

  private readonly storageRoot: string;
  private readonly maxSizeBytes: number | null;
  private readonly logger: Logger | null;

  constructor({
    storageRoot,
    maxSizeBytes,
    logger,
  }: {
    storageRoot: string;
    maxSizeBytes?: number;
    logger?: Logger;
  }) {
    this.storageRoot = resolve(storageRoot);
    this.maxSizeBytes = maxSizeBytes ?? null;
    this.logger = logger ?? null;
  }

  async upload(params: BlobUploadParams): Promise<StoredBlobMetadata> {
    if (this.maxSizeBytes !== null && params.data.byteLength > this.maxSizeBytes) {
      throw new BlobTooLargeError(params.data.byteLength, this.maxSizeBytes);
    }

    const blobPath = this.resolvePath(params.storageKey);
    const metaPath = blobPath + ".meta.json";
    const dir = dirname(blobPath);

    // Ensure system directory exists
    await mkdir(dir, { recursive: true });

    const uploadedAt = now();
    const sidecar: SidecarMetadata = {
      mimeType: params.mimeType,
      checksum: params.checksum,
      uploadedAt,
    };

    // Atomic exclusive write: temp file + link (fails with EEXIST if blob already exists)
    const tmpBlob = `${blobPath}.tmp-${randomUUID()}`;
    const tmpMeta = `${metaPath}.tmp-${randomUUID()}`;

    try {
      await writeFile(tmpBlob, params.data, { mode: FILE_MODE });
      await writeFile(tmpMeta, JSON.stringify(sidecar), { mode: FILE_MODE });
      await link(tmpBlob, blobPath);
      await link(tmpMeta, metaPath);
    } catch (err) {
      if (isNodeError(err) && err.code === "EEXIST") {
        throw new BlobAlreadyExistsError(params.storageKey);
      }
      // Non-EEXIST error: clean up any partially-linked final files
      await this.silentUnlink(blobPath);
      await this.silentUnlink(metaPath);
      throw err;
    } finally {
      // Always clean up temp files
      await this.silentUnlink(tmpBlob);
      await this.silentUnlink(tmpMeta);
    }

    return {
      storageKey: params.storageKey,
      sizeBytes: params.data.byteLength,
      mimeType: params.mimeType,
      checksum: params.checksum,
      uploadedAt,
    };
  }

  async download(storageKey: StorageKey): Promise<Uint8Array> {
    const blobPath = this.resolvePath(storageKey);
    try {
      return new Uint8Array(await readFile(blobPath));
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        throw new BlobNotFoundError(storageKey);
      }
      throw err;
    }
  }

  async delete(storageKey: StorageKey): Promise<void> {
    const blobPath = this.resolvePath(storageKey);
    const metaPath = blobPath + ".meta.json";
    await this.silentUnlink(blobPath);
    await this.silentUnlink(metaPath);
  }

  async exists(storageKey: StorageKey): Promise<boolean> {
    const blobPath = this.resolvePath(storageKey);
    return this.fileExists(blobPath);
  }

  async getMetadata(storageKey: StorageKey): Promise<StoredBlobMetadata | null> {
    const blobPath = this.resolvePath(storageKey);
    const metaPath = blobPath + ".meta.json";

    let blobStat;
    try {
      blobStat = await stat(blobPath);
    } catch {
      return null;
    }

    let sidecar: SidecarMetadata;
    try {
      const raw = await readFile(metaPath, "utf-8");
      sidecar = JSON.parse(raw) as SidecarMetadata;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      this.logger?.warn("Failed to parse sidecar metadata JSON, returning null", {
        metaPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    return {
      storageKey,
      sizeBytes: blobStat.size,
      mimeType: sidecar.mimeType,
      checksum: sidecar.checksum,
      uploadedAt: sidecar.uploadedAt,
    };
  }

  generatePresignedUploadUrl(): Promise<PresignedUrlResult> {
    return Promise.resolve({ supported: false } as const);
  }

  generatePresignedDownloadUrl(): Promise<PresignedUrlResult> {
    return Promise.resolve({ supported: false } as const);
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Resolves a storage key to an absolute path under storageRoot.
   * Guards against path traversal attacks.
   */
  private resolvePath(storageKey: string): string {
    if (storageKey.includes("..")) {
      throw new StorageBackendError(
        `Invalid storage key: path traversal detected in "${storageKey}".`,
      );
    }

    const resolved = resolve(this.storageRoot, storageKey);
    if (!resolved.startsWith(this.storageRoot + "/")) {
      throw new StorageBackendError(`Invalid storage key: resolved path escapes storage root.`);
    }

    return resolved;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async silentUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Idempotent — ignore errors
    }
  }
}
