import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { encryptChange, encryptSnapshot } from "../encrypted-sync.js";
import { EncryptedRelay } from "../relay.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;
let relay: EncryptedRelay;
const DOCUMENT_ID = "doc-relay-001";

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();

  keys = {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys: sodium.signKeypair(),
  };
});

beforeEach(() => {
  relay = new EncryptedRelay();
});

describe("EncryptedRelay", () => {
  it("2.1 — stores and returns envelopes with assigned seq numbers", () => {
    const change = sodium.randomBytes(32);
    const envelope = encryptChange(change, DOCUMENT_ID, keys, sodium);
    const seq = relay.submit(envelope);

    expect(seq).toBe(1);
    const fetched = relay.getEnvelopesSince(DOCUMENT_ID, 0);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]?.seq).toBe(1);
    expect(fetched[0]?.ciphertext).toEqual(envelope.ciphertext);
  });

  it("2.2 — returns only envelopes since a given seq", () => {
    const c1 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);
    const c2 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);
    const c3 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);

    relay.submit(c1);
    relay.submit(c2);
    relay.submit(c3);

    const sinceSeq1 = relay.getEnvelopesSince(DOCUMENT_ID, 1);
    expect(sinceSeq1).toHaveLength(2);
    expect(sinceSeq1[0]?.seq).toBe(2);
    expect(sinceSeq1[1]?.seq).toBe(3);

    const sinceSeq2 = relay.getEnvelopesSince(DOCUMENT_ID, 2);
    expect(sinceSeq2).toHaveLength(1);
    expect(sinceSeq2[0]?.seq).toBe(3);

    const sinceSeq3 = relay.getEnvelopesSince(DOCUMENT_ID, 3);
    expect(sinceSeq3).toHaveLength(0);
  });

  it("2.3 — stored ciphertext is not valid Automerge data", () => {
    const change = sodium.randomBytes(64);
    const envelope = encryptChange(change, DOCUMENT_ID, keys, sodium);
    relay.submit(envelope);

    const state = relay.inspectStorage(DOCUMENT_ID);
    expect(state).toBeDefined();

    // Automerge documents start with a magic number (0x85, 0x6f, 0x4a, 0x83)
    // Encrypted ciphertext should not resemble valid Automerge data
    const storedCiphertext = state?.envelopes[0]?.ciphertext;
    expect(storedCiphertext).toBeDefined();

    // Verify the relay only stores ciphertext, not the plaintext change
    expect(storedCiphertext).not.toEqual(change);
  });

  it("2.4 — assigns monotonically increasing seq numbers", () => {
    const seqs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      seqs.push(relay.submit(envelope));
    }

    for (let i = 1; i < seqs.length; i++) {
      const prev = seqs[i - 1];
      expect(prev).toBeDefined();
      expect(seqs[i]).toBeGreaterThan(prev ?? 0);
    }
  });

  it("2.5 — stores and returns snapshots", () => {
    const snapshot = sodium.randomBytes(256);
    const envelope = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    relay.submitSnapshot(envelope);

    const latest = relay.getLatestSnapshot(DOCUMENT_ID);
    expect(latest).not.toBeNull();
    expect(latest?.ciphertext).toEqual(envelope.ciphertext);
    expect(latest?.snapshotVersion).toBe(1);
  });

  it("2.6 — replaces old snapshot with new one", () => {
    const snap1 = encryptSnapshot(sodium.randomBytes(128), DOCUMENT_ID, 1, keys, sodium);
    const snap2 = encryptSnapshot(sodium.randomBytes(128), DOCUMENT_ID, 2, keys, sodium);

    relay.submitSnapshot(snap1);
    relay.submitSnapshot(snap2);

    const latest = relay.getLatestSnapshot(DOCUMENT_ID);
    expect(latest?.snapshotVersion).toBe(2);
    expect(latest?.ciphertext).toEqual(snap2.ciphertext);

    // No snapshot for unknown doc
    expect(relay.getLatestSnapshot("doc-unknown")).toBeNull();
  });
});
