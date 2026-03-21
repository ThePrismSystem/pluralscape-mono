/**
 * Contract test suite for OfflineQueueAdapter implementations.
 *
 * Usage:
 *   import { runOfflineQueueAdapterContract } from "./offline-queue-adapter.contract.js";
 *   runOfflineQueueAdapterContract(() => new YourOfflineQueueAdapter());
 */
import { describe, expect, it } from "vitest";

import { docId, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { OfflineQueueAdapter } from "../adapters/offline-queue-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

function makeEnvelope(docId: SyncDocumentId, fill = 1): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId: docId,
    ciphertext: new Uint8Array([1, 2, 3, fill]),
    nonce: nonce(fill),
    signature: sig(fill),
    authorPublicKey: pubkey(fill),
  };
}

export function runOfflineQueueAdapterContract(factory: () => OfflineQueueAdapter): void {
  describe("OfflineQueueAdapter contract", () => {
    describe("enqueue / drainUnsynced", () => {
      it("returns empty array when no entries exist", async () => {
        const adapter = factory();
        const result = await adapter.drainUnsynced();
        expect(result).toHaveLength(0);
      });

      it("returns enqueued entries in order", async () => {
        const adapter = factory();
        const docA = docId("doc_a");
        const id1 = await adapter.enqueue(docA, makeEnvelope(docA, 1));
        const id2 = await adapter.enqueue(docA, makeEnvelope(docA, 2));

        const entries = await adapter.drainUnsynced();
        expect(entries).toHaveLength(2);
        expect(entries[0]?.id).toBe(id1);
        expect(entries[1]?.id).toBe(id2);
        expect(entries[0]?.documentId).toBe("doc_a");
      });

      it("returns entries from multiple documents", async () => {
        const adapter = factory();
        await adapter.enqueue(docId("doc_a"), makeEnvelope(docId("doc_a"), 1));
        await adapter.enqueue(docId("doc_b"), makeEnvelope(docId("doc_b"), 2));

        const entries = await adapter.drainUnsynced();
        expect(entries).toHaveLength(2);
      });

      it("returns a unique ID for each enqueued entry", async () => {
        const adapter = factory();
        const docA = docId("doc_a");
        const id1 = await adapter.enqueue(docA, makeEnvelope(docA, 1));
        const id2 = await adapter.enqueue(docA, makeEnvelope(docA, 2));
        expect(id1).not.toBe(id2);
      });
    });

    describe("markSynced", () => {
      it("marks an entry as synced so it no longer appears in drainUnsynced", async () => {
        const adapter = factory();
        const id = await adapter.enqueue(docId("doc_a"), makeEnvelope(docId("doc_a"), 1));
        await adapter.markSynced(id, 42);

        const entries = await adapter.drainUnsynced();
        expect(entries).toHaveLength(0);
      });

      it("only marks the specified entry", async () => {
        const adapter = factory();
        const docA = docId("doc_a");
        const id1 = await adapter.enqueue(docA, makeEnvelope(docA, 1));
        await adapter.enqueue(docA, makeEnvelope(docA, 2));
        await adapter.markSynced(id1, 1);

        const entries = await adapter.drainUnsynced();
        expect(entries).toHaveLength(1);
      });
    });

    describe("deleteConfirmed", () => {
      it("deletes synced entries older than cutoff", async () => {
        const adapter = factory();
        const id = await adapter.enqueue(docId("doc_a"), makeEnvelope(docId("doc_a"), 1));
        await adapter.markSynced(id, 1);

        // Delete entries synced before the far future
        const deleted = await adapter.deleteConfirmed(Date.now() + 100_000);
        expect(deleted).toBeGreaterThanOrEqual(1);
      });

      it("does not delete unsynced entries", async () => {
        const adapter = factory();
        await adapter.enqueue(docId("doc_a"), makeEnvelope(docId("doc_a"), 1));

        const deleted = await adapter.deleteConfirmed(Date.now() + 100_000);
        expect(deleted).toBe(0);

        const entries = await adapter.drainUnsynced();
        expect(entries).toHaveLength(1);
      });

      it("returns 0 when nothing to delete", async () => {
        const adapter = factory();
        const deleted = await adapter.deleteConfirmed(Date.now());
        expect(deleted).toBe(0);
      });
    });
  });
}
