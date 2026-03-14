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

import { makeSnapshot, nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";

// ── Test data builders ─────────────────────────────────────────────────

function makeChange(seq: number, documentId: string): EncryptedChangeEnvelope {
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
        const docId = "doc_snap1";
        const snapshot = makeSnapshot(1, docId);
        await adapter.saveSnapshot(docId, snapshot);
        const loaded = await adapter.loadSnapshot(docId);
        expect(loaded).not.toBeNull();
        expect(loaded?.snapshotVersion).toBe(1);
        expect(new Uint8Array(loaded?.ciphertext ?? [])).toEqual(snapshot.ciphertext);
      });

      it("overwrites the previous snapshot on re-save", async () => {
        const adapter = factory();
        const docId = "doc_snap_overwrite";
        await adapter.saveSnapshot(docId, makeSnapshot(1, docId));
        await adapter.saveSnapshot(docId, makeSnapshot(2, docId));
        const loaded = await adapter.loadSnapshot(docId);
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
        const docId = "doc_order";
        await adapter.appendChange(docId, makeChange(3, docId));
        await adapter.appendChange(docId, makeChange(1, docId));
        await adapter.appendChange(docId, makeChange(2, docId));
        const result = await adapter.loadChangesSince(docId, 0);
        expect(result.map((c) => c.seq)).toEqual([1, 2, 3]);
      });

      it("loadChangesSince(seq) excludes envelopes at or below seq", async () => {
        const adapter = factory();
        const docId = "doc_since";
        for (let i = 1; i <= 5; i++) {
          await adapter.appendChange(docId, makeChange(i, docId));
        }
        const result = await adapter.loadChangesSince(docId, 3);
        expect(result.map((c) => c.seq)).toEqual([4, 5]);
      });

      it("does not cross-contaminate changes between documents", async () => {
        const adapter = factory();
        await adapter.appendChange("doc_a", makeChange(1, "doc_a"));
        await adapter.appendChange("doc_b", makeChange(1, "doc_b"));
        const result = await adapter.loadChangesSince("doc_a", 0);
        expect(result).toHaveLength(1);
        expect(result[0]?.documentId).toBe("doc_a");
      });
    });

    describe("pruneChangesBeforeSnapshot", () => {
      it("removes changes with seq ≤ snapshotVersion", async () => {
        const adapter = factory();
        const docId = "doc_prune";
        for (let i = 1; i <= 5; i++) {
          await adapter.appendChange(docId, makeChange(i, docId));
        }
        await adapter.pruneChangesBeforeSnapshot(docId, 3);
        const result = await adapter.loadChangesSince(docId, 0);
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
        const docId = "doc_list1";
        await adapter.saveSnapshot(docId, makeSnapshot(1, docId));
        const result = await adapter.listDocuments();
        expect(result).toContain(docId);
      });

      it("lists a document after a change is appended", async () => {
        const adapter = factory();
        const docId = "doc_list2";
        await adapter.appendChange(docId, makeChange(1, docId));
        const result = await adapter.listDocuments();
        expect(result).toContain(docId);
      });

      it("does not list the same document twice", async () => {
        const adapter = factory();
        const docId = "doc_list_dedup";
        await adapter.appendChange(docId, makeChange(1, docId));
        await adapter.appendChange(docId, makeChange(2, docId));
        const result = await adapter.listDocuments();
        const count = result.filter((id) => id === docId).length;
        expect(count).toBe(1);
      });
    });

    describe("deleteDocument", () => {
      it("removes snapshot and changes for the document", async () => {
        const adapter = factory();
        const docId = "doc_delete";
        await adapter.saveSnapshot(docId, makeSnapshot(1, docId));
        await adapter.appendChange(docId, makeChange(1, docId));
        await adapter.deleteDocument(docId);

        expect(await adapter.loadSnapshot(docId)).toBeNull();
        expect(await adapter.loadChangesSince(docId, 0)).toHaveLength(0);
        expect(await adapter.listDocuments()).not.toContain(docId);
      });

      it("is a no-op for a non-existent document", async () => {
        const adapter = factory();
        await expect(adapter.deleteDocument("doc_ghost")).resolves.not.toThrow();
      });

      it("does not affect other documents", async () => {
        const adapter = factory();
        await adapter.saveSnapshot("doc_keep", makeSnapshot(1, "doc_keep"));
        await adapter.saveSnapshot("doc_remove", makeSnapshot(1, "doc_remove"));
        await adapter.deleteDocument("doc_remove");

        expect(await adapter.loadSnapshot("doc_keep")).not.toBeNull();
      });
    });
  });
}
