import { toHex } from "@pluralscape/crypto";

import {
  RELAY_MAX_ENVELOPES_PER_DOCUMENT,
  RELAY_MAX_SNAPSHOT_SIZE_BYTES,
} from "./relay.constants.js";

import type { SyncRelayService } from "./relay-service.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

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
  /** Maximum size in bytes for a single snapshot ciphertext. Default: Infinity (no limit). */
  readonly maxSnapshotSizeBytes?: number;
  /** Called when a document is evicted from the relay. */
  readonly onEvict?: (documentId: string) => void;
}

export class EncryptedRelay {
  private readonly documents = new Map<string, EncryptedChangeEnvelope[]>();
  private readonly snapshots = new Map<string, EncryptedSnapshotEnvelope>();
  /**
   * LRU tracking via Map insertion order. Most-recently-used entries are at the end.
   * touch() deletes and re-inserts to move to end; eviction takes the first key (oldest).
   */
  private readonly accessOrder = new Map<string, true>();
  private readonly seqCounters = new Map<string, number>();
  /** Nonce-based dedup index: (documentId, authorPublicKey, nonce) -> assigned seq. */
  private readonly dedupIndex = new Map<string, number>();
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

  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): number {
    // Dedup: if (documentId, authorPublicKey, nonce) already submitted, return existing seq
    const dedupKey = this.buildDedupKey(envelope);
    const existingSeq = this.dedupIndex.get(dedupKey);
    if (existingSeq !== undefined) {
      return existingSeq;
    }

    // Evict LRU documents first so stale docs don't block limit checks
    this.evictIfNeeded(envelope.documentId);

    // Enforce per-document envelope limit (checked after eviction so LRU cleanup always runs)
    const docEnvelopes = this.documents.get(envelope.documentId);
    if (docEnvelopes && docEnvelopes.length >= this.maxEnvelopesPerDocument) {
      throw new EnvelopeLimitExceededError(envelope.documentId, this.maxEnvelopesPerDocument);
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
    this.dedupIndex.set(dedupKey, seq);
    let docDedupKeys = this.dedupByDoc.get(envelope.documentId);
    if (!docDedupKeys) {
      docDedupKeys = new Set();
      this.dedupByDoc.set(envelope.documentId, docDedupKeys);
    }
    docDedupKeys.add(dedupKey);

    this.touch(envelope.documentId);

    return seq;
  }

  /** Return envelopes since a given seq using binary search + slice (O(log n)). */
  getEnvelopesSince(documentId: string, sinceSeq: number): readonly EncryptedChangeEnvelope[] {
    const docEnvelopes = this.documents.get(documentId);
    if (!docEnvelopes) {
      return [];
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
    return docEnvelopes.slice(low);
  }

  submitSnapshot(envelope: EncryptedSnapshotEnvelope): void {
    this.evictIfNeeded(envelope.documentId);
    if (envelope.ciphertext.byteLength > this.maxSnapshotSizeBytes) {
      throw new SnapshotSizeLimitExceededError(
        envelope.documentId,
        envelope.ciphertext.byteLength,
        this.maxSnapshotSizeBytes,
      );
    }
    const existing = this.snapshots.get(envelope.documentId);
    if (existing && existing.snapshotVersion >= envelope.snapshotVersion) {
      throw new SnapshotVersionConflictError(envelope.snapshotVersion, existing.snapshotVersion);
    }
    this.snapshots.set(envelope.documentId, envelope);
    this.touch(envelope.documentId);
  }

  getLatestSnapshot(documentId: string): EncryptedSnapshotEnvelope | null {
    const snapshot = this.snapshots.get(documentId) ?? null;
    if (snapshot !== null || this.documents.has(documentId)) {
      this.touch(documentId);
    }
    return snapshot;
  }

  /** Wrap this relay as an async SyncRelayService for use with WS handlers. */
  asService(): SyncRelayService {
    return {
      submit: (envelope) => Promise.resolve(this.submit(envelope)),
      getEnvelopesSince: (documentId, sinceSeq) =>
        Promise.resolve(this.getEnvelopesSince(documentId, sinceSeq)),
      submitSnapshot: (envelope) => {
        this.submitSnapshot(envelope);
        return Promise.resolve();
      },
      getLatestSnapshot: (d) => Promise.resolve(this.getLatestSnapshot(d)),
      getManifest: (id) => Promise.resolve({ documents: [], systemId: id }),
    };
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

  /** Build a composite dedup key from (documentId, authorPublicKey, nonce). */
  private buildDedupKey(envelope: Omit<EncryptedChangeEnvelope, "seq">): string {
    return `${envelope.documentId}:${toHex(envelope.authorPublicKey)}:${toHex(envelope.nonce)}`;
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
