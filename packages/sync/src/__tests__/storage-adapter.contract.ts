/**
 * Contract test suite for SyncStorageAdapter implementations.
 *
 * Usage:
 *   import { runStorageAdapterContract } from "./storage-adapter.contract.js";
 *   runStorageAdapterContract(() => new YourStorageAdapter());
 *
 * The factory function is called before each test to produce a fresh,
 * empty adapter instance.
 */
import { describe, expect, it } from "vitest";

import { docId, makeSnapshot, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

// ── Test data builders ─────────────────────────────────────────────────

function makeChange(seq: number, documentId: SyncDocumentId): EncryptedChangeEnvelope {
  return {
    documentId,
    seq,
    ciphertext: new Uint8Array([1, 2, 3, seq]),
    nonce: nonce(seq),
    signature: sig(2),
    authorPublicKey: pubkey(1),
  };
}

// ── Contract ───────────────────────────────────────────────────────────

export function runStorageAdapterContract(factory: () => SyncStorageAdapter): void {
  describe("SyncStorageAdapter contract", () => {
    describe("loadSnapshot / saveSnapshot", () => {
      it("returns null for a document with no snapshot", async () => {
        const adapter = factory();
        const result = await adapter.loadSnapshot("doc_none");
        expect(result).toBeNull();
      });

      it("round-trips a saved snapshot", async () => {
        const adapter = factory();
        const testDocId = docId("doc_snap1");
        const snapshot = makeSnapshot(1, testDocId);
        await adapter.saveSnapshot(testDocId, snapshot);
        const loaded = await adapter.loadSnapshot(testDocId);
        expect(loaded).not.toBeNull();
        expect(loaded?.snapshotVersion).toBe(1);
        expect(new Uint8Array(loaded?.ciphertext ?? [])).toEqual(snapshot.ciphertext);
      });

      it("overwrites the previous snapshot on re-save", async () => {
        const adapter = factory();
        const testDocId = docId("doc_snap_overwrite");
        await adapter.saveSnapshot(testDocId, makeSnapshot(1, testDocId));
        await adapter.saveSnapshot(testDocId, makeSnapshot(2, testDocId));
        const loaded = await adapter.loadSnapshot(testDocId);
        expect(loaded?.snapshotVersion).toBe(2);
      });
    });

    describe("appendChange / loadChangesSince", () => {
      it("returns empty array when no changes exist", async () => {
        const adapter = factory();
        const result = await adapter.loadChangesSince("doc_empty_changes", 0);
        expect(result).toHaveLength(0);
      });

      it("returns changes in ascending seq order", async () => {
        const adapter = factory();
        const testDocId = docId("doc_order");
        await adapter.appendChange(testDocId, makeChange(3, testDocId));
        await adapter.appendChange(testDocId, makeChange(1, testDocId));
        await adapter.appendChange(testDocId, makeChange(2, testDocId));
        const result = await adapter.loadChangesSince(testDocId, 0);
        expect(result.map((c) => c.seq)).toEqual([1, 2, 3]);
      });

      it("loadChangesSince(seq) excludes envelopes at or below seq", async () => {
        const adapter = factory();
        const testDocId = docId("doc_since");
        for (let i = 1; i <= 5; i++) {
          await adapter.appendChange(testDocId, makeChange(i, testDocId));
        }
        const result = await adapter.loadChangesSince(testDocId, 3);
        expect(result.map((c) => c.seq)).toEqual([4, 5]);
      });

      it("does not cross-contaminate changes between documents", async () => {
        const adapter = factory();
        await adapter.appendChange("doc_a", makeChange(1, docId("doc_a")));
        await adapter.appendChange("doc_b", makeChange(1, docId("doc_b")));
        const result = await adapter.loadChangesSince("doc_a", 0);
        expect(result).toHaveLength(1);
        expect(result[0]?.documentId).toBe("doc_a");
      });
    });

    describe("appendChanges (batch)", () => {
      it("persists multiple changes in a single call", async () => {
        const adapter = factory();
        if (!adapter.appendChanges) return;
        const testDocId = docId("doc_batch");
        const changes = [
          makeChange(1, testDocId),
          makeChange(2, testDocId),
          makeChange(3, testDocId),
        ];
        await adapter.appendChanges(testDocId, changes);
        const result = await adapter.loadChangesSince(testDocId, 0);
        expect(result.map((c) => c.seq)).toEqual([1, 2, 3]);
      });

      it("is a no-op for empty array", async () => {
        const adapter = factory();
        if (!adapter.appendChanges) return;
        await expect(adapter.appendChanges("doc_empty_batch", [])).resolves.not.toThrow();
        const result = await adapter.loadChangesSince("doc_empty_batch", 0);
        expect(result).toHaveLength(0);
      });

      it("does not cross-contaminate between documents", async () => {
        const adapter = factory();
        if (!adapter.appendChanges) return;
        await adapter.appendChanges("doc_a", [
          makeChange(1, docId("doc_a")),
          makeChange(2, docId("doc_a")),
        ]);
        await adapter.appendChanges("doc_b", [makeChange(1, docId("doc_b"))]);
        const resultA = await adapter.loadChangesSince("doc_a", 0);
        const resultB = await adapter.loadChangesSince("doc_b", 0);
        expect(resultA).toHaveLength(2);
        expect(resultB).toHaveLength(1);
      });
    });

    describe("pruneChangesBeforeSnapshot", () => {
      it("removes changes with seq ≤ snapshotVersion", async () => {
        const adapter = factory();
        const testDocId = docId("doc_prune");
        for (let i = 1; i <= 5; i++) {
          await adapter.appendChange(testDocId, makeChange(i, testDocId));
        }
        await adapter.pruneChangesBeforeSnapshot(testDocId, 3);
        const result = await adapter.loadChangesSince(testDocId, 0);
        expect(result.map((c) => c.seq)).toEqual([4, 5]);
      });

      it("is a no-op when no changes exist", async () => {
        const adapter = factory();
        // Should not throw
        await expect(
          adapter.pruneChangesBeforeSnapshot("doc_prune_empty", 5),
        ).resolves.not.toThrow();
      });
    });

    describe("listDocuments", () => {
      it("returns empty array when nothing is stored", async () => {
        const adapter = factory();
        const result = await adapter.listDocuments();
        expect(result).toHaveLength(0);
      });

      it("lists a document after a snapshot is saved", async () => {
        const adapter = factory();
        const testDocId = docId("doc_list1");
        await adapter.saveSnapshot(testDocId, makeSnapshot(1, testDocId));
        const result = await adapter.listDocuments();
        expect(result).toContain(testDocId);
      });

      it("lists a document after a change is appended", async () => {
        const adapter = factory();
        const testDocId = docId("doc_list2");
        await adapter.appendChange(testDocId, makeChange(1, testDocId));
        const result = await adapter.listDocuments();
        expect(result).toContain(testDocId);
      });

      it("does not list the same document twice", async () => {
        const adapter = factory();
        const testDocId = docId("doc_list_dedup");
        await adapter.appendChange(testDocId, makeChange(1, testDocId));
        await adapter.appendChange(testDocId, makeChange(2, testDocId));
        const result = await adapter.listDocuments();
        const count = result.filter((id) => id === testDocId).length;
        expect(count).toBe(1);
      });
    });

    describe("deleteDocument", () => {
      it("removes snapshot and changes for the document", async () => {
        const adapter = factory();
        const testDocId = docId("doc_delete");
        await adapter.saveSnapshot(testDocId, makeSnapshot(1, testDocId));
        await adapter.appendChange(testDocId, makeChange(1, testDocId));
        await adapter.deleteDocument(testDocId);

        expect(await adapter.loadSnapshot(testDocId)).toBeNull();
        expect(await adapter.loadChangesSince(testDocId, 0)).toHaveLength(0);
        expect(await adapter.listDocuments()).not.toContain(testDocId);
      });

      it("is a no-op for a non-existent document", async () => {
        const adapter = factory();
        await expect(adapter.deleteDocument("doc_ghost")).resolves.not.toThrow();
      });

      it("does not affect other documents", async () => {
        const adapter = factory();
        await adapter.saveSnapshot("doc_keep", makeSnapshot(1, docId("doc_keep")));
        await adapter.saveSnapshot("doc_remove", makeSnapshot(1, docId("doc_remove")));
        await adapter.deleteDocument("doc_remove");

        expect(await adapter.loadSnapshot("doc_keep")).not.toBeNull();
      });
    });
  });
}
