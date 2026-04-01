import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createIndexedDbOfflineQueueAdapter } from "../indexeddb-offline-queue-adapter.js";

import type { EncryptedChangeEnvelope } from "@pluralscape/sync";
import type { OfflineQueueAdapter } from "@pluralscape/sync/adapters";
import type { SyncDocumentId } from "@pluralscape/types";

const DOC_A = "doc-a" as SyncDocumentId;

let dbCounter = 0;
function freshAdapter(): OfflineQueueAdapter {
  dbCounter += 1;
  return createIndexedDbOfflineQueueAdapter(`test-offline-queue-${dbCounter.toString()}`);
}

function makeEnvelope(documentId: SyncDocumentId): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: new Uint8Array([4, 5, 6]) as EncryptedChangeEnvelope["nonce"],
    signature: new Uint8Array([7, 8, 9]) as EncryptedChangeEnvelope["signature"],
    authorPublicKey: new Uint8Array([10, 11, 12]) as EncryptedChangeEnvelope["authorPublicKey"],
  };
}

describe("createIndexedDbOfflineQueueAdapter", () => {
  it("enqueues an entry with oq_ prefix id and null syncedAt", async () => {
    const adapter = freshAdapter();
    const id = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    expect(id).toMatch(/^oq_/);

    const entries = await adapter.drainUnsynced();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(id);
    expect(entries[0]?.syncedAt).toBeNull();
    expect(entries[0]?.serverSeq).toBeNull();
    expect(entries[0]?.documentId).toBe(DOC_A);
  });

  it("drainUnsynced returns empty after all entries are marked synced", async () => {
    const adapter = freshAdapter();
    const id = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    await adapter.markSynced(id, 42);

    const entries = await adapter.drainUnsynced();
    expect(entries).toHaveLength(0);
  });

  it("marks an entry as synced with the given serverSeq", async () => {
    const adapter = freshAdapter();
    const id = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    await adapter.markSynced(id, 99);

    const deleted = await adapter.deleteConfirmed(Date.now() + 1000);
    expect(deleted).toBe(1);
  });

  it("deleteConfirmed removes only synced entries older than cutoff", async () => {
    const adapter = freshAdapter();
    const id1 = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    const id2 = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    const cutoff = Date.now() + 1000;
    await adapter.markSynced(id1, 1);

    const deleted = await adapter.deleteConfirmed(cutoff);
    expect(deleted).toBe(1);

    const remaining = await adapter.drainUnsynced();
    expect(remaining.map((e) => e.id)).toContain(id2);
  });

  it("deleteConfirmed returns 0 when no entries meet the cutoff", async () => {
    const adapter = freshAdapter();
    const id = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    await adapter.markSynced(id, 1);
    const deleted = await adapter.deleteConfirmed(0);
    expect(deleted).toBe(0);
  });

  it("drains entries in enqueue order (ascending enqueuedAt)", async () => {
    const adapter = freshAdapter();
    const id1 = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    const id2 = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    const id3 = await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));

    const entries = await adapter.drainUnsynced();
    expect(entries.map((e) => e.id)).toEqual([id1, id2, id3]);
  });

  it("envelope stored without seq field", async () => {
    const adapter = freshAdapter();
    await adapter.enqueue(DOC_A, makeEnvelope(DOC_A));
    const entries = await adapter.drainUnsynced();
    expect(entries[0]?.envelope).not.toHaveProperty("seq");
  });
});
