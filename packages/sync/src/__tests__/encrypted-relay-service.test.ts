/**
 * Tests for EncryptedRelay.asService() wrapper.
 */
import { describe, expect, it } from "vitest";

import { EncryptedRelay } from "../relay.js";

import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";

function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}
function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}
function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

function mockChange(docId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(0xaa),
    signature: sig(0xbb),
    authorPublicKey: pubkey(0xcc),
    documentId: docId,
  };
}

function mockSnapshot(docId: string, version: number): EncryptedSnapshotEnvelope {
  return {
    ciphertext: new Uint8Array([4, 5, 6]),
    nonce: nonce(0xdd),
    signature: sig(0xee),
    authorPublicKey: pubkey(0xff),
    documentId: docId,
    snapshotVersion: version,
  };
}

describe("EncryptedRelay.asService()", () => {
  it("submit delegates and returns a seq number", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();
    const docId = "test-doc-1";

    const seq = await service.submit(mockChange(docId));

    expect(seq).toBe(1);
    expect(relay.getEnvelopesSince(docId, 0)).toHaveLength(1);
  });

  it("getEnvelopesSince delegates correctly", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();
    const docId = "test-doc-2";

    relay.submit(mockChange(docId));
    relay.submit({ ...mockChange(docId), nonce: nonce(0x11) });

    const result = await service.getEnvelopesSince(docId, 1);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]?.seq).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("submitSnapshot delegates correctly", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();
    const docId = "test-doc-3";

    await service.submitSnapshot(mockSnapshot(docId, 1));

    const snapshot = relay.getLatestSnapshot(docId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshotVersion).toBe(1);
  });

  it("getLatestSnapshot delegates correctly", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();
    const docId = "test-doc-4";

    relay.submitSnapshot(mockSnapshot(docId, 5));

    const snapshot = await service.getLatestSnapshot(docId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshotVersion).toBe(5);
  });

  it("getManifest returns the requested systemId", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();

    const manifest = await service.getManifest("sys_other" as SystemId);
    expect(manifest.systemId).toBe("sys_other");
    expect(manifest.documents).toEqual([]);
  });

  it("getManifest works when asService is called without a systemId", async () => {
    const relay = new EncryptedRelay();
    const service = relay.asService();

    const manifest = await service.getManifest("sys_test" as SystemId);
    expect(manifest.systemId).toBe("sys_test");
  });
});
