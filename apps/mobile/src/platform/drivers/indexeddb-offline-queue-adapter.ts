import { idbRequest, openIdb } from "./indexeddb-utils.js";

import type { EncryptedChangeEnvelope } from "@pluralscape/sync";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "@pluralscape/sync/adapters";
import type { SyncDocumentId } from "@pluralscape/types";

const DB_VERSION = 1;
const STORE_QUEUE = "queue";

interface QueueRecord {
  id: string;
  documentId: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  authorPublicKey: Uint8Array;
  enqueuedAt: number;
  syncedAt: number | null;
  serverSeq: number | null;
}

function recordToEntry(r: QueueRecord): OfflineQueueEntry {
  return {
    id: r.id,
    documentId: r.documentId as SyncDocumentId,
    envelope: {
      documentId: r.documentId as SyncDocumentId,
      ciphertext: r.ciphertext,
      nonce: r.nonce as OfflineQueueEntry["envelope"]["nonce"],
      signature: r.signature as OfflineQueueEntry["envelope"]["signature"],
      authorPublicKey: r.authorPublicKey as OfflineQueueEntry["envelope"]["authorPublicKey"],
    },
    enqueuedAt: r.enqueuedAt,
    syncedAt: r.syncedAt,
    serverSeq: r.serverSeq,
  };
}

function entryToQueueRecord(
  id: string,
  documentId: SyncDocumentId,
  envelope: Omit<EncryptedChangeEnvelope, "seq">,
  enqueuedAt: number,
): QueueRecord {
  return {
    id,
    documentId,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce as Uint8Array,
    signature: envelope.signature as Uint8Array,
    authorPublicKey: envelope.authorPublicKey as Uint8Array,
    enqueuedAt,
    syncedAt: null,
    serverSeq: null,
  };
}

/** Generates a unique ID for queue entries. */
function generateId(): string {
  return `oq_${crypto.randomUUID()}`;
}

/** Monotonically increasing timestamp — ensures stable enqueue order within a millisecond. */
let lastEnqueuedAt = 0;
function monotonicNow(): number {
  const now = Date.now();
  lastEnqueuedAt = now > lastEnqueuedAt ? now : lastEnqueuedAt + 1;
  return lastEnqueuedAt;
}

/** IndexedDB-backed OfflineQueueAdapter for web fallback (browsers without OPFS). */
export function createIndexedDbOfflineQueueAdapter(
  dbName = "pluralscape-offline-queue",
): OfflineQueueAdapter {
  const dbPromise = openIdb(dbName, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_QUEUE)) {
      const store = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      store.createIndex("byEnqueuedAt", "enqueuedAt");
      store.createIndex("bySyncedAt", "syncedAt");
    }
  });

  return {
    async enqueue(
      documentId: SyncDocumentId,
      envelope: Omit<EncryptedChangeEnvelope, "seq">,
    ): Promise<string> {
      const db = await dbPromise;
      const id = generateId();
      const now = monotonicNow();
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      await idbRequest(store.add(entryToQueueRecord(id, documentId, envelope, now)));
      return id;
    },

    async drainUnsynced(): Promise<readonly OfflineQueueEntry[]> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_QUEUE, "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const all = await idbRequest<QueueRecord[]>(store.getAll() as IDBRequest<QueueRecord[]>);
      return all
        .filter((r) => r.syncedAt === null)
        .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
        .map(recordToEntry);
    },

    async markSynced(id: string, serverSeq: number): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const existing = await idbRequest<QueueRecord | undefined>(
        store.get(id) as IDBRequest<QueueRecord | undefined>,
      );
      if (!existing) return;
      const updated: QueueRecord = { ...existing, syncedAt: Date.now(), serverSeq };
      await idbRequest(store.put(updated));
    },

    async deleteConfirmed(cutoffMs: number): Promise<number> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const all = await idbRequest<QueueRecord[]>(store.getAll() as IDBRequest<QueueRecord[]>);
      const toDelete = all.filter((r) => r.syncedAt !== null && r.syncedAt < cutoffMs);
      await Promise.all(toDelete.map((r) => idbRequest(store.delete(r.id))));
      return toDelete.length;
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
