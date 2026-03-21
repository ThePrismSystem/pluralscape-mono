import { deriveSyncEncryptionKey } from "@pluralscape/crypto";

import { parseDocumentId } from "./document-types.js";
import { AdapterDisposedError } from "./errors.js";

import type { DocumentKeys } from "./types.js";
import type {
  AeadKey,
  BucketKeyCache,
  KdfMasterKey,
  SignKeypair,
  SodiumAdapter,
} from "@pluralscape/crypto";

/** Configuration for constructing a DocumentKeyResolver. */
export interface DocumentKeyResolverConfig {
  readonly masterKey: KdfMasterKey;
  readonly signingKeys: SignKeypair;
  readonly bucketKeyCache: BucketKeyCache;
  readonly sodium: SodiumAdapter;
}

/** Thrown when a bucket key is not present in the cache. */
export class BucketKeyNotFoundError extends Error {
  readonly bucketId: string;

  constructor(bucketId: string) {
    super(`Bucket key not found in cache for bucket "${bucketId}"`);
    this.name = "BucketKeyNotFoundError";
    this.bucketId = bucketId;
  }
}

/**
 * Maps sync document IDs to the correct DocumentKeys for EncryptedSyncSession.
 *
 * For derived-key documents (system-core, fronting, chat, journal, privacy-config),
 * derives a sync-specific encryption key via KDF ("syncdocx" context).
 *
 * For bucket documents, looks up the per-bucket key from the BucketKeyCache.
 *
 * Memory ownership:
 * - Resolver owns the derived sync key (zeroed on dispose)
 * - Bucket keys are borrowed from BucketKeyCache (cache owns lifecycle)
 * - Signing keys are borrowed from caller
 */
export class DocumentKeyResolver {
  private syncKey: AeadKey;
  private readonly signingKeys: SignKeypair;
  private readonly bucketKeyCache: BucketKeyCache;
  private readonly sodium: SodiumAdapter;
  private disposed = false;

  private constructor(
    syncKey: AeadKey,
    signingKeys: SignKeypair,
    bucketKeyCache: BucketKeyCache,
    sodium: SodiumAdapter,
  ) {
    this.syncKey = syncKey;
    this.signingKeys = signingKeys;
    this.bucketKeyCache = bucketKeyCache;
    this.sodium = sodium;
  }

  static create(config: DocumentKeyResolverConfig): DocumentKeyResolver {
    const syncKey = deriveSyncEncryptionKey(config.masterKey, config.sodium);
    return new DocumentKeyResolver(
      syncKey,
      config.signingKeys,
      config.bucketKeyCache,
      config.sodium,
    );
  }

  /** Resolve a document ID to the encryption key and signing keys for sync. */
  resolveKeys(documentId: string): DocumentKeys {
    if (this.disposed) {
      throw new AdapterDisposedError("DocumentKeyResolver has been disposed");
    }

    const parsed = parseDocumentId(documentId);

    if (parsed.keyType === "bucket") {
      const bucketKey = this.bucketKeyCache.get(parsed.entityId);
      if (bucketKey === undefined) {
        throw new BucketKeyNotFoundError(parsed.entityId);
      }
      return { encryptionKey: bucketKey, signingKeys: this.signingKeys };
    }

    return { encryptionKey: this.syncKey, signingKeys: this.signingKeys };
  }

  /** Zero the cached sync key and mark the resolver as disposed. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.sodium.memzero(this.syncKey);
  }
}
