import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

/** Error message fragment for snapshot version conflicts. */
export const SNAPSHOT_VERSION_CONFLICT_MESSAGE = "is not newer than current version";

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
  private readonly lastAccess = new Map<string, number>();
  private readonly seqCounters = new Map<string, number>();
  private readonly maxDocuments: number;
  private readonly onEvict?: (documentId: string) => void;

  constructor(options?: RelayOptions) {
    this.maxDocuments = options?.maxDocuments ?? Infinity;
    this.onEvict = options?.onEvict;
  }

  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): number {
    this.evictIfNeeded(envelope.documentId);
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

  getEnvelopesSince(documentId: string, sinceSeq: number): readonly EncryptedChangeEnvelope[] {
    const docEnvelopes = this.documents.get(documentId);
    if (!docEnvelopes) {
      return [];
    }
    this.touch(documentId);
    return docEnvelopes.filter((e) => e.seq > sinceSeq);
  }

  submitSnapshot(envelope: EncryptedSnapshotEnvelope): void {
    this.evictIfNeeded(envelope.documentId);
    const existing = this.snapshots.get(envelope.documentId);
    if (existing && existing.snapshotVersion >= envelope.snapshotVersion) {
      throw new Error(
        `Snapshot version ${String(envelope.snapshotVersion)} ${SNAPSHOT_VERSION_CONFLICT_MESSAGE} ${String(existing.snapshotVersion)}`,
      );
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

  /** Update the last-access timestamp for LRU tracking. */
  private touch(documentId: string): void {
    this.lastAccess.set(documentId, Date.now());
  }

  /** Evict the least-recently-accessed document if at capacity, skipping the incoming doc. */
  private evictIfNeeded(incomingDocId?: string): void {
    if (this.lastAccess.size < this.maxDocuments) return;

    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [docId, time] of this.lastAccess) {
      if (docId === incomingDocId) continue;
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = docId;
      }
    }

    if (oldestId !== null) {
      this.documents.delete(oldestId);
      this.snapshots.delete(oldestId);
      this.lastAccess.delete(oldestId);
      this.seqCounters.delete(oldestId);
      this.onEvict?.(oldestId);
    }
  }
}
