import { idbRequest, openIdb } from "./indexeddb-utils.js";

import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";
import type { SyncStorageAdapter } from "@pluralscape/sync/adapters";
import type { SyncDocumentId } from "@pluralscape/types";

const DB_VERSION = 1;
const STORE_SNAPSHOTS = "snapshots";
const STORE_CHANGES = "changes";

interface SnapshotRecord {
  documentId: string;
  snapshotVersion: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  authorPublicKey: Uint8Array;
}

interface ChangeRecord {
  documentId: string;
  seq: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  authorPublicKey: Uint8Array;
}

function recordToSnapshot(r: SnapshotRecord): EncryptedSnapshotEnvelope {
  return {
    documentId: r.documentId as SyncDocumentId,
    snapshotVersion: r.snapshotVersion,
    ciphertext: r.ciphertext,
    nonce: r.nonce as EncryptedSnapshotEnvelope["nonce"],
    signature: r.signature as EncryptedSnapshotEnvelope["signature"],
    authorPublicKey: r.authorPublicKey as EncryptedSnapshotEnvelope["authorPublicKey"],
  };
}

function recordToChange(r: ChangeRecord): EncryptedChangeEnvelope {
  return {
    documentId: r.documentId as SyncDocumentId,
    seq: r.seq,
    ciphertext: r.ciphertext,
    nonce: r.nonce as EncryptedChangeEnvelope["nonce"],
    signature: r.signature as EncryptedChangeEnvelope["signature"],
    authorPublicKey: r.authorPublicKey as EncryptedChangeEnvelope["authorPublicKey"],
  };
}

function snapshotToRecord(
  documentId: SyncDocumentId,
  snapshot: EncryptedSnapshotEnvelope,
): SnapshotRecord {
  return {
    documentId,
    snapshotVersion: snapshot.snapshotVersion,
    ciphertext: snapshot.ciphertext,
    nonce: snapshot.nonce as Uint8Array,
    signature: snapshot.signature as Uint8Array,
    authorPublicKey: snapshot.authorPublicKey as Uint8Array,
  };
}

function changeToRecord(documentId: SyncDocumentId, change: EncryptedChangeEnvelope): ChangeRecord {
  return {
    documentId,
    seq: change.seq,
    ciphertext: change.ciphertext,
    nonce: change.nonce as Uint8Array,
    signature: change.signature as Uint8Array,
    authorPublicKey: change.authorPublicKey as Uint8Array,
  };
}

/** IndexedDB-backed SyncStorageAdapter for web fallback (browsers without OPFS). */
export function createIndexedDbStorageAdapter(
  dbName = "pluralscape-sync-storage",
): SyncStorageAdapter {
  const dbPromise = openIdb(dbName, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
      db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "documentId" });
    }
    if (!db.objectStoreNames.contains(STORE_CHANGES)) {
      const changesStore = db.createObjectStore(STORE_CHANGES, {
        keyPath: ["documentId", "seq"],
      });
      changesStore.createIndex("byDoc", "documentId");
    }
  });

  return {
    async loadSnapshot(documentId: SyncDocumentId): Promise<EncryptedSnapshotEnvelope | null> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_SNAPSHOTS, "readonly");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const result = await idbRequest<SnapshotRecord | undefined>(
        store.get(documentId) as IDBRequest<SnapshotRecord | undefined>,
      );
      return result ? recordToSnapshot(result) : null;
    },

    async saveSnapshot(
      documentId: SyncDocumentId,
      snapshot: EncryptedSnapshotEnvelope,
    ): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      await idbRequest(store.put(snapshotToRecord(documentId, snapshot)));
    },

    async loadChangesSince(
      documentId: SyncDocumentId,
      sinceSeq: number,
    ): Promise<readonly EncryptedChangeEnvelope[]> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_CHANGES, "readonly");
      const store = tx.objectStore(STORE_CHANGES);
      const index = store.index("byDoc");
      const all = await idbRequest<ChangeRecord[]>(
        index.getAll(documentId) as IDBRequest<ChangeRecord[]>,
      );
      return all
        .filter((r) => r.seq > sinceSeq)
        .sort((a, b) => a.seq - b.seq)
        .map(recordToChange);
    },

    async appendChange(documentId: SyncDocumentId, change: EncryptedChangeEnvelope): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_CHANGES, "readwrite");
      const store = tx.objectStore(STORE_CHANGES);
      await idbRequest(store.put(changeToRecord(documentId, change)));
    },

    async appendChanges(
      documentId: SyncDocumentId,
      changes: readonly EncryptedChangeEnvelope[],
    ): Promise<void> {
      if (changes.length === 0) return;
      const db = await dbPromise;
      const tx = db.transaction(STORE_CHANGES, "readwrite");
      const store = tx.objectStore(STORE_CHANGES);
      await Promise.all(
        changes.map((change) => idbRequest(store.put(changeToRecord(documentId, change)))),
      );
    },

    async pruneChangesBeforeSnapshot(
      documentId: SyncDocumentId,
      snapshotVersion: number,
    ): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_CHANGES, "readwrite");
      const store = tx.objectStore(STORE_CHANGES);
      const index = store.index("byDoc");
      const all = await idbRequest<ChangeRecord[]>(
        index.getAll(documentId) as IDBRequest<ChangeRecord[]>,
      );
      await Promise.all(
        all
          .filter((r) => r.seq <= snapshotVersion)
          .map((r) => idbRequest(store.delete([documentId, r.seq]))),
      );
    },

    async listDocuments(): Promise<readonly SyncDocumentId[]> {
      const db = await dbPromise;
      const tx = db.transaction([STORE_SNAPSHOTS, STORE_CHANGES], "readonly");

      const snapshotIds = await idbRequest<string[]>(
        tx.objectStore(STORE_SNAPSHOTS).getAllKeys() as IDBRequest<string[]>,
      );
      const changesIndex = tx.objectStore(STORE_CHANGES).index("byDoc");
      const changeIds = await new Promise<string[]>((resolve, reject) => {
        const ids: string[] = [];
        const req = changesIndex.openKeyCursor(null, "nextunique");
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const key = cursor.key;
            if (typeof key === "string") ids.push(key);
            cursor.continue();
          } else {
            resolve(ids);
          }
        };
        req.onerror = () => {
          reject(req.error instanceof Error ? req.error : new Error("IDB cursor error"));
        };
      });

      const all = new Set([...snapshotIds, ...changeIds]);
      return [...all] as SyncDocumentId[];
    },

    async deleteDocument(documentId: SyncDocumentId): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction([STORE_SNAPSHOTS, STORE_CHANGES], "readwrite");

      await idbRequest(tx.objectStore(STORE_SNAPSHOTS).delete(documentId));

      const changesStore = tx.objectStore(STORE_CHANGES);
      const index = changesStore.index("byDoc");
      const all = await idbRequest<ChangeRecord[]>(
        index.getAll(documentId) as IDBRequest<ChangeRecord[]>,
      );
      await Promise.all(all.map((r) => idbRequest(changesStore.delete([documentId, r.seq]))));
    },

    close(): void {
      void dbPromise
        .then((db) => {
          db.close();
        })
        .catch(() => {
          // Close errors during teardown are non-recoverable — the DB handle
          // is being discarded regardless. Logging requires a Logger not yet
          // available in the mobile app.
        });
    },
  };
}
