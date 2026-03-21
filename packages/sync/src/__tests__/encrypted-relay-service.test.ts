/**
 * Tests for EncryptedRelay implementing SyncRelayService directly.
 */
import { describe, expect, it } from "vitest";

import { EncryptedRelay } from "../relay.js";

import { docId, nonce, pubkey, sig, sysId } from "./test-crypto-helpers.js";

import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

function mockChange(id: SyncDocumentId): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(0xaa),
    signature: sig(0xbb),
    authorPublicKey: pubkey(0xcc),
    documentId: id,
  };
}

function mockSnapshot(id: SyncDocumentId, version: number): EncryptedSnapshotEnvelope {
  return {
    ciphertext: new Uint8Array([4, 5, 6]),
    nonce: nonce(0xdd),
    signature: sig(0xee),
    authorPublicKey: pubkey(0xff),
    documentId: id,
    snapshotVersion: version,
  };
}

describe("EncryptedRelay as SyncRelayService", () => {
  it("submit returns a seq number", async () => {
    const relay = new EncryptedRelay();
    const testDocId = docId("test-doc-1");

    const seq = await relay.submit(mockChange(testDocId));

    expect(seq).toBe(1);
    const result = await relay.getEnvelopesSince(testDocId, 0);
    expect(result.envelopes).toHaveLength(1);
  });

  it("getEnvelopesSince returns paginated results", async () => {
    const relay = new EncryptedRelay();
    const testDocId = docId("test-doc-2");

    await relay.submit(mockChange(testDocId));
    await relay.submit({ ...mockChange(testDocId), nonce: nonce(0x11) });

    const result = await relay.getEnvelopesSince(testDocId, 1);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]?.seq).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("getEnvelopesSince respects limit parameter", async () => {
    const relay = new EncryptedRelay();
    const testDocId = docId("test-doc-paginate");

    await relay.submit(mockChange(testDocId));
    await relay.submit({ ...mockChange(testDocId), nonce: nonce(0x11) });
    await relay.submit({ ...mockChange(testDocId), nonce: nonce(0x22) });

    const result = await relay.getEnvelopesSince(testDocId, 0, 2);
    expect(result.envelopes).toHaveLength(2);
    expect(result.hasMore).toBe(true);

    const resultAll = await relay.getEnvelopesSince(testDocId, 0);
    expect(resultAll.envelopes).toHaveLength(3);
    expect(resultAll.hasMore).toBe(false);
  });

  it("submitSnapshot works directly", async () => {
    const relay = new EncryptedRelay();
    const testDocId = docId("test-doc-3");

    await relay.submitSnapshot(mockSnapshot(testDocId, 1));

    const snapshot = await relay.getLatestSnapshot(testDocId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshotVersion).toBe(1);
  });

  it("getLatestSnapshot works directly", async () => {
    const relay = new EncryptedRelay();
    const testDocId = docId("test-doc-4");

    await relay.submitSnapshot(mockSnapshot(testDocId, 5));

    const snapshot = await relay.getLatestSnapshot(testDocId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshotVersion).toBe(5);
  });

  it("getManifest returns the requested systemId", async () => {
    const relay = new EncryptedRelay();

    const manifest = await relay.getManifest(sysId("sys_other"));
    expect(manifest.systemId).toBe("sys_other");
    expect(manifest.documents).toEqual([]);
  });

  it("getManifest returns empty documents for any systemId", async () => {
    const relay = new EncryptedRelay();

    const manifest = await relay.getManifest(sysId("sys_test"));
    expect(manifest.systemId).toBe("sys_test");
  });
});
