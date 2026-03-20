import type { SyncRelayService } from "./relay-service.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

/** Constant-time-safe byte-by-byte comparison for Uint8Array values. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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

export interface RelayDocumentState {
  readonly envelopes: readonly EncryptedChangeEnvelope[];
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}

/** Options for configuring relay behavior. */
export interface RelayOptions {
  /** Maximum number of documents before LRU eviction. Default: Infinity (no limit). */
  readonly maxDocuments?: number;
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
  private readonly maxDocuments: number;
  private readonly onEvict?: (documentId: string) => void;

  constructor(options?: RelayOptions) {
    this.maxDocuments = options?.maxDocuments ?? Infinity;
    this.onEvict = options?.onEvict;
  }

  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): number {
    this.evictIfNeeded(envelope.documentId);

    // Dedup: if (documentId, authorPublicKey, nonce) already exists, return existing seq
    const existing = this.documents.get(envelope.documentId);
    if (existing) {
      for (const e of existing) {
        if (
          bytesEqual(e.authorPublicKey, envelope.authorPublicKey) &&
          bytesEqual(e.nonce, envelope.nonce)
        ) {
          this.touch(envelope.documentId);
          return e.seq;
        }
      }
    }

    const currentSeq = this.seqCounters.get(envelope.documentId) ?? 0;
    const seq = currentSeq + 1;
    this.seqCounters.set(envelope.documentId, seq);
    const withSeq: EncryptedChangeEnvelope = { ...envelope, seq };

    let docEnvelopes = this.documents.get(envelope.documentId);
    if (!docEnvelopes) {
      docEnvelopes = [];
      this.documents.set(envelope.documentId, docEnvelopes);
    }
    docEnvelopes.push(withSeq);
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
      this.documents.delete(oldestId);
      this.snapshots.delete(oldestId);
      this.accessOrder.delete(oldestId);
      this.seqCounters.delete(oldestId);
      this.onEvict?.(oldestId);
    }
  }
}
