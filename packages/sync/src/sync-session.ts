import * as Automerge from "@automerge/automerge";

import {
  decryptChange,
  decryptSnapshot,
  encryptChange,
  encryptSnapshot,
} from "./encrypted-sync.js";

import type { EncryptedRelay } from "./relay.js";
import type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

interface SyncSessionConfig<T> {
  doc: Automerge.Doc<T>;
  keys: DocumentKeys;
  documentId: string;
  sodium: SodiumAdapter;
}

export class EncryptedSyncSession<T> {
  private doc: Automerge.Doc<T>;
  private readonly keys: DocumentKeys;
  readonly documentId: string;
  private readonly sodium: SodiumAdapter;
  private lastSeenSeq: number;

  constructor(config: SyncSessionConfig<T>) {
    this.doc = config.doc;
    this.keys = config.keys;
    this.documentId = config.documentId;
    this.sodium = config.sodium;
    this.lastSeenSeq = 0;
  }

  get document(): Automerge.Doc<T> {
    return this.doc;
  }

  get lastSyncedSeq(): number {
    return this.lastSeenSeq;
  }

  change(fn: (doc: T) => void): Omit<EncryptedChangeEnvelope, "seq"> {
    this.doc = Automerge.change(this.doc, fn);
    const lastChange = Automerge.getLastLocalChange(this.doc);
    if (!lastChange) {
      throw new Error("Automerge.change produced no diff");
    }
    return encryptChange(lastChange, this.documentId, this.keys, this.sodium);
  }

  applyEncryptedChanges(envelopes: readonly EncryptedChangeEnvelope[]): void {
    for (const envelope of envelopes) {
      if (envelope.seq <= this.lastSeenSeq) {
        continue;
      }
      const changeBytes = decryptChange(envelope, this.keys.encryptionKey, this.sodium);
      const [newDoc] = Automerge.applyChanges(this.doc, [changeBytes]);
      this.doc = newDoc;
      this.lastSeenSeq = envelope.seq;
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
  ): EncryptedSyncSession<T> {
    const savedBytes = decryptSnapshot(envelope, keys.encryptionKey, sodium);
    const doc = Automerge.load<T>(savedBytes);
    return new EncryptedSyncSession({
      doc,
      keys,
      documentId: envelope.documentId,
      sodium,
    });
  }
}

export function syncThroughRelay<T>(
  sessions: readonly EncryptedSyncSession<T>[],
  relay: EncryptedRelay,
): void {
  // Keep syncing until no new changes are produced
  let changed = true;
  while (changed) {
    changed = false;
    for (const session of sessions) {
      const envelopes = relay.getEnvelopesSince(session.documentId, session.lastSyncedSeq);
      if (envelopes.length > 0) {
        session.applyEncryptedChanges(envelopes);
        changed = true;
      }
    }
  }
}
