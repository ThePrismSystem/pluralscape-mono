import { AEAD_NONCE_BYTES, SIGN_PUBLIC_KEY_BYTES } from "@pluralscape/crypto";

import {
  RELAY_MAX_ENVELOPES_PER_DOCUMENT,
  RELAY_MAX_SNAPSHOT_SIZE_BYTES,
} from "./relay.constants.js";

import type { SyncManifest } from "./adapters/network-adapter.js";
import type { PaginatedEnvelopes, SyncRelayService } from "./relay-service.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { SystemId } from "@pluralscape/types";

/**
 * Number of bytes in the composite dedup key buffer.
 * authorPublicKey (32 bytes Ed25519) + nonce (24 bytes XChaCha20).
 */
const DEDUP_KEY_BUFFER_BYTES = SIGN_PUBLIC_KEY_BYTES + AEAD_NONCE_BYTES;

/** Thrown when a snapshot submission has a version not newer than the current one. */
export class SnapshotVersionConflictError extends Error {
  override readonly name = "SnapshotVersionConflictError" as const;
  readonly currentVersion: number;
  readonly attemptedVersion: number;

  constructor(attemptedVersion: number, currentVersion: number, options?: ErrorOptions) {
    super(
      `Snapshot version ${String(attemptedVersion)} is not newer than current version ${String(currentVersion)}`,
      options,
    );
    this.currentVersion = currentVersion;
    this.attemptedVersion = attemptedVersion;
  }
}

/**
 * Thrown when a document exceeds its per-document envelope limit.
 * The client should compact the document and retry.
 */
export class EnvelopeLimitExceededError extends Error {
  override readonly name = "EnvelopeLimitExceededError" as const;
  readonly documentId: string;
  readonly limit: number;

  constructor(documentId: string, limit: number, options?: ErrorOptions) {
    super(
      `Document "${documentId}" has reached the envelope limit of ${String(limit)}. ` +
        `Please compact the document and retry.`,
      options,
    );
    this.documentId = documentId;
    this.limit = limit;
  }
}

/**
 * Thrown when a snapshot's ciphertext exceeds the configured size limit.
 */
export class SnapshotSizeLimitExceededError extends Error {
  override readonly name = "SnapshotSizeLimitExceededError" as const;
  readonly documentId: string;
  readonly sizeBytes: number;
  readonly limit: number;

  constructor(documentId: string, sizeBytes: number, limit: number, options?: ErrorOptions) {
    super(
      `Snapshot for document "${documentId}" is ${String(sizeBytes)} bytes, ` +
        `exceeding the limit of ${String(limit)} bytes.`,
      options,
    );
    this.documentId = documentId;
    this.sizeBytes = sizeBytes;
    this.limit = limit;
  }
}

export interface RelayDocumentState {
  readonly envelopes: readonly EncryptedChangeEnvelope[];
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}

/** Options for configuring relay behavior. */
export interface RelayOptions {
  /** Maximum number of documents before LRU eviction. Default: Infinity (no limit). */
  readonly maxDocuments?: number;
  /** Maximum number of change envelopes per document. Default: RELAY_MAX_ENVELOPES_PER_DOCUMENT (10,000). */
  readonly maxEnvelopesPerDocument?: number;
  /** Maximum size in bytes for a single snapshot ciphertext. Default: RELAY_MAX_SNAPSHOT_SIZE_BYTES (50 MiB). */
  readonly maxSnapshotSizeBytes?: number;
  /** Called when a document is evicted from the relay. */
  readonly onEvict?: (documentId: string) => void;
}

export class EncryptedRelay implements SyncRelayService {
  private readonly documents = new Map<string, EncryptedChangeEnvelope[]>();
  private readonly snapshots = new Map<string, EncryptedSnapshotEnvelope>();
  /**
   * LRU tracking via Map insertion order. Most-recently-used entries are at the end.
   * touch() deletes and re-inserts to move to end; eviction takes the first key (oldest).
   */
  private readonly accessOrder = new Map<string, true>();
  private readonly seqCounters = new Map<string, number>();
  /** Nonce-based dedup index: compositeKey(authorPublicKey, nonce) -> { documentId, seq }. */
  private readonly dedupIndex = new Map<
    string,
    { readonly documentId: string; readonly seq: number }
  >();
  /** Secondary index: documentId -> Set of dedup keys for O(k) eviction cleanup. */
  private readonly dedupByDoc = new Map<string, Set<string>>();
  private readonly maxDocuments: number;
  private readonly maxEnvelopesPerDocument: number;
  private readonly maxSnapshotSizeBytes: number;
  private readonly onEvict?: (documentId: string) => void;

  constructor(options?: RelayOptions) {
    this.maxDocuments = options?.maxDocuments ?? Infinity;
    this.maxEnvelopesPerDocument =
      options?.maxEnvelopesPerDocument ?? RELAY_MAX_ENVELOPES_PER_DOCUMENT;
    this.maxSnapshotSizeBytes = options?.maxSnapshotSizeBytes ?? RELAY_MAX_SNAPSHOT_SIZE_BYTES;
    this.onEvict = options?.onEvict;
  }

  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<number> {
    // Dedup: if (authorPublicKey, nonce) already submitted for this document, return existing seq
    const dedupKey = buildDedupKey(envelope);
    const existing = this.dedupIndex.get(dedupKey);
    if (existing?.documentId === envelope.documentId) {
      return Promise.resolve(existing.seq);
    }

    // Cross-document key collision: clean up the stale dedupByDoc reference
    // before overwriting. Astronomically unlikely with random 24-byte nonces,
    // but keeps the secondary index consistent.
    if (existing) {
      const oldDocKeys = this.dedupByDoc.get(existing.documentId);
      if (oldDocKeys) {
        oldDocKeys.delete(dedupKey);
        if (oldDocKeys.size === 0) this.dedupByDoc.delete(existing.documentId);
      }
    }

    // Evict LRU documents first so stale docs don't block limit checks
    this.evictIfNeeded(envelope.documentId);

    // Enforce per-document envelope limit (checked after eviction so LRU cleanup always runs)
    const docEnvelopes = this.documents.get(envelope.documentId);
    if (docEnvelopes && docEnvelopes.length >= this.maxEnvelopesPerDocument) {
      return Promise.reject(
        new EnvelopeLimitExceededError(envelope.documentId, this.maxEnvelopesPerDocument),
      );
    }

    const currentSeq = this.seqCounters.get(envelope.documentId) ?? 0;
    const seq = currentSeq + 1;
    this.seqCounters.set(envelope.documentId, seq);
    const withSeq: EncryptedChangeEnvelope = { ...envelope, seq };

    let envelopes = docEnvelopes;
    if (!envelopes) {
      envelopes = [];
      this.documents.set(envelope.documentId, envelopes);
    }
    envelopes.push(withSeq);

    // Update both dedup indexes
    this.dedupIndex.set(dedupKey, { documentId: envelope.documentId, seq });
    let docDedupKeys = this.dedupByDoc.get(envelope.documentId);
    if (!docDedupKeys) {
      docDedupKeys = new Set();
      this.dedupByDoc.set(envelope.documentId, docDedupKeys);
    }
    docDedupKeys.add(dedupKey);

    this.touch(envelope.documentId);

    return Promise.resolve(seq);
  }

  /**
   * Return envelopes since a given seq using binary search + slice (O(log n)).
   *
   * When `limit` is provided, results are capped. `hasMore` indicates whether
   * additional envelopes exist beyond the returned page.
   */
  getEnvelopesSince(
    documentId: string,
    sinceSeq: number,
    limit?: number,
  ): Promise<PaginatedEnvelopes> {
    const docEnvelopes = this.documents.get(documentId);
    if (!docEnvelopes) {
      return Promise.resolve({ envelopes: [], hasMore: false });
    }
    this.touch(documentId);

    // Binary search for the first envelope with seq > sinceSeq
    let low = 0;
    let high = docEnvelopes.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const envelope = docEnvelopes[mid];
      if (envelope && envelope.seq <= sinceSeq) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const all = docEnvelopes.slice(low);
    if (limit !== undefined && all.length > limit) {
      return Promise.resolve({ envelopes: all.slice(0, limit), hasMore: true });
    }
    return Promise.resolve({ envelopes: all, hasMore: false });
  }

  submitSnapshot(envelope: EncryptedSnapshotEnvelope): Promise<void> {
    this.evictIfNeeded(envelope.documentId);
    if (envelope.ciphertext.byteLength > this.maxSnapshotSizeBytes) {
      return Promise.reject(
        new SnapshotSizeLimitExceededError(
          envelope.documentId,
          envelope.ciphertext.byteLength,
          this.maxSnapshotSizeBytes,
        ),
      );
    }
    const existing = this.snapshots.get(envelope.documentId);
    if (existing && existing.snapshotVersion >= envelope.snapshotVersion) {
      return Promise.reject(
        new SnapshotVersionConflictError(envelope.snapshotVersion, existing.snapshotVersion),
      );
    }
    this.snapshots.set(envelope.documentId, envelope);

    // Prune dedup entries for all changes up to the document's current seq.
    // Snapshot acceptance means these changes are subsumed; their dedup entries can be freed.
    const currentSeq = this.seqCounters.get(envelope.documentId) ?? 0;
    this.pruneDedupForDocument(envelope.documentId, currentSeq);

    this.touch(envelope.documentId);
    return Promise.resolve();
  }

  getLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const snapshot = this.snapshots.get(documentId) ?? null;
    if (snapshot !== null || this.documents.has(documentId)) {
      this.touch(documentId);
    }
    return Promise.resolve(snapshot);
  }

  /**
   * Returns an empty manifest. The in-memory relay does not track the document
   * metadata (docType, keyType, bucketId, etc.) required by SyncManifestEntry,
   * so it cannot produce a meaningful manifest. Production uses PgSyncRelayService.
   */
  getManifest(systemId: SystemId): Promise<SyncManifest> {
    return Promise.resolve({ documents: [], systemId });
  }

  /** Returns `this` — kept for call-site compatibility while callers migrate. */
  asService(): SyncRelayService {
    return this;
  }

  inspectStorage(documentId: string): RelayDocumentState | undefined {
    const envelopes = this.documents.get(documentId);
    if (!envelopes) {
      return undefined;
    }
    return {
      envelopes: [...envelopes],
      snapshot: this.snapshots.get(documentId) ?? null,
    };
  }

  /**
   * Prune dedup entries for a document where the associated seq is <= upToSeq.
   *
   * Called after a snapshot is accepted: all changes up to the document's
   * current seq are subsumed by the snapshot and their dedup entries can be freed.
   */
  private pruneDedupForDocument(documentId: string, upToSeq: number): void {
    const docDedupKeys = this.dedupByDoc.get(documentId);
    if (!docDedupKeys) return;

    // Safe: ES2015 Set iterator handles mid-loop deletion (deleted elements are skipped).
    for (const key of docDedupKeys) {
      const entry = this.dedupIndex.get(key);
      if (entry && entry.seq <= upToSeq) {
        this.dedupIndex.delete(key);
        docDedupKeys.delete(key);
      }
    }

    // Clean up the secondary index if all entries were pruned
    if (docDedupKeys.size === 0) {
      this.dedupByDoc.delete(documentId);
    }
  }

  /** Move documentId to end of insertion order (most-recently-used). O(1). */
  private touch(documentId: string): void {
    this.accessOrder.delete(documentId);
    this.accessOrder.set(documentId, true);
  }

  /** Evict the least-recently-accessed document if at capacity, skipping the incoming doc. */
  private evictIfNeeded(incomingDocId?: string): void {
    if (this.accessOrder.size < this.maxDocuments) return;

    // If the incoming doc is already tracked, no eviction needed
    if (incomingDocId && this.accessOrder.has(incomingDocId)) return;

    // First key in Map is the oldest (LRU). O(1).
    let oldestId: string | null = null;
    for (const [docId] of this.accessOrder) {
      if (docId !== incomingDocId) {
        oldestId = docId;
        break;
      }
    }

    if (oldestId !== null) {
      // O(k) dedup cleanup via secondary index instead of O(n) startsWith scan
      const docDedupKeys = this.dedupByDoc.get(oldestId);
      if (docDedupKeys) {
        for (const key of docDedupKeys) {
          this.dedupIndex.delete(key);
        }
        this.dedupByDoc.delete(oldestId);
      }
      this.documents.delete(oldestId);
      this.snapshots.delete(oldestId);
      this.accessOrder.delete(oldestId);
      this.seqCounters.delete(oldestId);
      this.onEvict?.(oldestId);
    }
  }
}

/**
 * Build a composite dedup key from (authorPublicKey, nonce).
 *
 * Instead of hex-encoding each field and string-concatenating with delimiters,
 * copies the two fixed-size byte arrays into a single buffer and encodes
 * to base64. This avoids the per-byte hex loop and produces a shorter key.
 */
function buildDedupKey(envelope: Omit<EncryptedChangeEnvelope, "seq">): string {
  const buf = new Uint8Array(DEDUP_KEY_BUFFER_BYTES);
  buf.set(envelope.authorPublicKey, 0);
  buf.set(envelope.nonce, SIGN_PUBLIC_KEY_BYTES);
  return bufferToBase64(buf);
}

/**
 * Encode a Uint8Array to base64. Uses built-in `btoa` which is
 * available in all modern runtimes (Bun, Node 16+, browsers).
 */
function bufferToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
