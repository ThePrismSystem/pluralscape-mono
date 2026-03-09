import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

export interface RelayDocumentState {
  readonly envelopes: readonly EncryptedChangeEnvelope[];
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}

export class EncryptedRelay {
  private readonly documents = new Map<string, EncryptedChangeEnvelope[]>();
  private readonly snapshots = new Map<string, EncryptedSnapshotEnvelope>();
  private nextSeq = 1;

  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): number {
    const seq = this.nextSeq++;
    const withSeq: EncryptedChangeEnvelope = { ...envelope, seq };

    let docEnvelopes = this.documents.get(envelope.documentId);
    if (!docEnvelopes) {
      docEnvelopes = [];
      this.documents.set(envelope.documentId, docEnvelopes);
    }
    docEnvelopes.push(withSeq);

    return seq;
  }

  getEnvelopesSince(documentId: string, sinceSeq: number): readonly EncryptedChangeEnvelope[] {
    const docEnvelopes = this.documents.get(documentId);
    if (!docEnvelopes) {
      return [];
    }
    return docEnvelopes.filter((e) => e.seq > sinceSeq);
  }

  submitSnapshot(envelope: EncryptedSnapshotEnvelope): void {
    const existing = this.snapshots.get(envelope.documentId);
    if (existing && existing.snapshotVersion >= envelope.snapshotVersion) {
      throw new Error(
        `Snapshot version ${String(envelope.snapshotVersion)} is not newer than current version ${String(existing.snapshotVersion)}`,
      );
    }
    this.snapshots.set(envelope.documentId, envelope);
  }

  getLatestSnapshot(documentId: string): EncryptedSnapshotEnvelope | null {
    return this.snapshots.get(documentId) ?? null;
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
}
