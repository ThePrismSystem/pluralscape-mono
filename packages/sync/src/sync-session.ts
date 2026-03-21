import * as Automerge from "@automerge/automerge";

import {
  decryptChange,
  decryptSnapshot,
  encryptChange,
  encryptSnapshot,
} from "./encrypted-sync.js";
import { NoChangeProducedError } from "./errors.js";

import type { EncryptedRelay } from "./relay.js";
import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

interface SyncSessionConfig<T> {
  doc: Automerge.Doc<T>;
  keys: DocumentKeys;
  documentId: string;
  sodium: SodiumAdapter;
  lastSyncedSeq?: number;
}

export class EncryptedSyncSession<T> {
  private doc: Automerge.Doc<T>;
  private readonly keys: DocumentKeys;
  readonly documentId: string;
  private readonly sodium: SodiumAdapter;
  private lastSyncedSeq_: number;

  constructor(config: SyncSessionConfig<T>) {
    this.doc = config.doc;
    this.keys = config.keys;
    this.documentId = config.documentId;
    this.sodium = config.sodium;
    this.lastSyncedSeq_ = config.lastSyncedSeq ?? 0;
  }

  get document(): Automerge.Doc<T> {
    return this.doc;
  }

  get lastSyncedSeq(): number {
    return this.lastSyncedSeq_;
  }

  change(fn: (doc: T) => void): Omit<EncryptedChangeEnvelope, "seq"> {
    this.doc = Automerge.change(this.doc, fn);
    const lastChange = Automerge.getLastLocalChange(this.doc);
    if (!lastChange) {
      throw new NoChangeProducedError();
    }
    return encryptChange(lastChange, this.documentId, this.keys, this.sodium);
  }

  applyEncryptedChanges(envelopes: readonly EncryptedChangeEnvelope[]): void {
    // M22: Skip sort for trivial arrays (0 or 1 elements are already sorted)
    const sorted = envelopes.length <= 1 ? envelopes : [...envelopes].sort((a, b) => a.seq - b.seq);
    const savedDoc = this.doc;
    const savedSeq = this.lastSyncedSeq_;
    try {
      // Batch decrypt all changes first, then apply in a single Automerge call
      const decrypted: Uint8Array[] = [];
      let maxSeq = this.lastSyncedSeq_;
      for (const envelope of sorted) {
        if (envelope.seq <= this.lastSyncedSeq_) {
          continue;
        }
        decrypted.push(decryptChange(envelope, this.keys.encryptionKey, this.sodium));
        maxSeq = envelope.seq;
      }
      if (decrypted.length > 0) {
        const [newDoc] = Automerge.applyChanges(this.doc, decrypted);
        this.doc = newDoc;
        this.lastSyncedSeq_ = maxSeq;
      }
    } catch (error) {
      this.doc = savedDoc;
      this.lastSyncedSeq_ = savedSeq;
      throw error;
    }
  }

  createSnapshot(version: number): EncryptedSnapshotEnvelope {
    const saved = Automerge.save(this.doc);
    return encryptSnapshot(saved, this.documentId, version, this.keys, this.sodium);
  }

  static fromSnapshot<T>(
    envelope: EncryptedSnapshotEnvelope,
    keys: DocumentKeys,
    sodium: SodiumAdapter,
    lastSyncedSeq?: number,
  ): EncryptedSyncSession<T> {
    const savedBytes = decryptSnapshot(envelope, keys.encryptionKey, sodium);
    const doc = Automerge.load<T>(savedBytes);
    return new EncryptedSyncSession({
      doc,
      keys,
      documentId: envelope.documentId,
      sodium,
      lastSyncedSeq,
    });
  }
}

export async function syncThroughRelay<T>(
  sessions: readonly EncryptedSyncSession<T>[],
  relay: EncryptedRelay,
): Promise<void> {
  for (const session of sessions) {
    const result = await relay.getEnvelopesSince(session.documentId, session.lastSyncedSeq);
    if (result.envelopes.length > 0) {
      session.applyEncryptedChanges(result.envelopes);
    }
  }
}
