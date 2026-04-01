import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createIndexedDbStorageAdapter } from "../indexeddb-storage-adapter.js";

import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";
import type { SyncStorageAdapter } from "@pluralscape/sync/adapters";
import type { SyncDocumentId } from "@pluralscape/types";

const DOC_A = "doc-a" as SyncDocumentId;
const DOC_B = "doc-b" as SyncDocumentId;

let dbCounter = 0;
function freshAdapter(): SyncStorageAdapter {
  dbCounter += 1;
  return createIndexedDbStorageAdapter(`test-sync-storage-${dbCounter.toString()}`);
}

function makeSnapshot(documentId: SyncDocumentId, version: number): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion: version,
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: new Uint8Array([4, 5, 6]) as EncryptedSnapshotEnvelope["nonce"],
    signature: new Uint8Array([7, 8, 9]) as EncryptedSnapshotEnvelope["signature"],
    authorPublicKey: new Uint8Array([10, 11, 12]) as EncryptedSnapshotEnvelope["authorPublicKey"],
  };
}

function makeChange(documentId: SyncDocumentId, seq: number): EncryptedChangeEnvelope {
  return {
    documentId,
    seq,
    ciphertext: new Uint8Array([seq]),
    nonce: new Uint8Array([seq, 1]) as EncryptedChangeEnvelope["nonce"],
    signature: new Uint8Array([seq, 2]) as EncryptedChangeEnvelope["signature"],
    authorPublicKey: new Uint8Array([seq, 3]) as EncryptedChangeEnvelope["authorPublicKey"],
  };
}

describe("createIndexedDbStorageAdapter", () => {
  it("returns null for missing snapshot", async () => {
    const adapter = freshAdapter();
    const result = await adapter.loadSnapshot(DOC_A);
    expect(result).toBeNull();
  });

  it("saves and loads a snapshot", async () => {
    const adapter = freshAdapter();
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 5));
    const loaded = await adapter.loadSnapshot(DOC_A);
    expect(loaded).not.toBeNull();
    expect(loaded?.documentId).toBe(DOC_A);
    expect(loaded?.snapshotVersion).toBe(5);
    expect(loaded?.ciphertext).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("overwrites an existing snapshot on save", async () => {
    const adapter = freshAdapter();
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 1));
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 2));
    const loaded = await adapter.loadSnapshot(DOC_A);
    expect(loaded?.snapshotVersion).toBe(2);
  });

  it("appends and loads changes since seq (exclusive, sorted)", async () => {
    const adapter = freshAdapter();
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 3));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 1));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 2));

    const changes = await adapter.loadChangesSince(DOC_A, 1);
    expect(changes.map((c) => c.seq)).toEqual([2, 3]);
  });

  it("returns empty array when no changes exist since seq", async () => {
    const adapter = freshAdapter();
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 1));
    const changes = await adapter.loadChangesSince(DOC_A, 5);
    expect(changes).toHaveLength(0);
  });

  it("prunes changes with seq <= snapshotVersion", async () => {
    const adapter = freshAdapter();
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 1));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 2));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 3));
    await adapter.pruneChangesBeforeSnapshot(DOC_A, 2);
    const remaining = await adapter.loadChangesSince(DOC_A, 0);
    expect(remaining.map((c) => c.seq)).toEqual([3]);
  });

  it("lists documents from both stores", async () => {
    const adapter = freshAdapter();
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 1));
    await adapter.appendChange(DOC_B, makeChange(DOC_B, 1));

    const docs = await adapter.listDocuments();
    expect(docs).toContain(DOC_A);
    expect(docs).toContain(DOC_B);
  });

  it("deduplicates documents that appear in both stores", async () => {
    const adapter = freshAdapter();
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 1));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 1));

    const docs = await adapter.listDocuments();
    const count = docs.filter((d) => d === DOC_A).length;
    expect(count).toBe(1);
  });

  it("deletes a document from both snapshot and changes stores", async () => {
    const adapter = freshAdapter();
    await adapter.saveSnapshot(DOC_A, makeSnapshot(DOC_A, 1));
    await adapter.appendChange(DOC_A, makeChange(DOC_A, 1));
    await adapter.deleteDocument(DOC_A);

    const snapshot = await adapter.loadSnapshot(DOC_A);
    const changes = await adapter.loadChangesSince(DOC_A, 0);
    expect(snapshot).toBeNull();
    expect(changes).toHaveLength(0);
  });

  it("appendChanges stores multiple changes in one call", async () => {
    const adapter = freshAdapter();
    const changes = [makeChange(DOC_A, 10), makeChange(DOC_A, 11), makeChange(DOC_A, 12)];
    await adapter.appendChanges?.(DOC_A, changes);
    const loaded = await adapter.loadChangesSince(DOC_A, 9);
    expect(loaded.map((c) => c.seq)).toEqual([10, 11, 12]);
  });
});
