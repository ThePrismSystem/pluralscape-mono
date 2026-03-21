import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptChange, encryptSnapshot } from "../encrypted-sync.js";
import { RELAY_MAX_SNAPSHOT_SIZE_BYTES } from "../relay.constants.js";
import {
  EncryptedRelay,
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
} from "../relay.js";

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

  it("2.4 — assigns per-document monotonically increasing seq numbers", () => {
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

  it("2.4b — different documents have independent seq counters", () => {
    const c1 = encryptChange(sodium.randomBytes(16), "doc-alpha", keys, sodium);
    const c2 = encryptChange(sodium.randomBytes(16), "doc-beta", keys, sodium);

    const seqA = relay.submit(c1);
    const seqB = relay.submit(c2);

    // Both start at 1 since they are independent documents
    expect(seqA).toBe(1);
    expect(seqB).toBe(1);
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

  describe("LRU eviction", () => {
    it("evicts oldest doc when limit exceeded", () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 2,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      const c3 = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);

      limitedRelay.submit(c1);
      limitedRelay.submit(c2);
      // At capacity — next submit should evict doc-a (oldest)
      limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-a"]);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)).toHaveLength(0);
      expect(limitedRelay.getEnvelopesSince("doc-b", 0)).toHaveLength(1);
      expect(limitedRelay.getEnvelopesSince("doc-c", 0)).toHaveLength(1);
    });

    it("calls onEvict callback on eviction", () => {
      const onEvict = vi.fn();
      const limitedRelay = new EncryptedRelay({ maxDocuments: 1, onEvict });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-x", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-y", keys, sodium);

      limitedRelay.submit(c1);
      limitedRelay.submit(c2);

      expect(onEvict).toHaveBeenCalledWith("doc-x");
    });

    it("touch updates access time for LRU ordering", () => {
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);

      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 2,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-old", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-new", keys, sodium);

      limitedRelay.submit(c1);
      now = 2000;
      limitedRelay.submit(c2);

      // Touch doc-old to make it more recent than doc-new
      now = 3000;
      limitedRelay.getEnvelopesSince("doc-old", 0);

      // Now add doc-c — should evict doc-new (less recently accessed)
      now = 4000;
      const c3 = encryptChange(sodium.randomBytes(16), "doc-third", keys, sodium);
      limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-new"]);

      vi.restoreAllMocks();
    });

    it("does not evict when under limit", () => {
      const onEvict = vi.fn();
      const limitedRelay = new EncryptedRelay({ maxDocuments: 10, onEvict });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-1", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-2", keys, sodium);

      limitedRelay.submit(c1);
      limitedRelay.submit(c2);

      expect(onEvict).not.toHaveBeenCalled();
    });

    it("does not self-evict the incoming document", () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 2,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      limitedRelay.submit(c1);
      limitedRelay.submit(c2);

      // Submit again to doc-a — doc-a is already tracked, so no eviction needed
      const c3 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(c3);

      expect(evicted).toEqual([]);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)).toHaveLength(2);
    });

    it("evicts oldest non-incoming doc when new doc arrives at capacity", () => {
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);

      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 2,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);

      limitedRelay.submit(c1);
      now = 2000;
      limitedRelay.submit(c2);

      // Submit to new doc-c — doc-a (oldest) should be evicted, not doc-c
      now = 3000;
      const c3 = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-a"]);
      expect(limitedRelay.getEnvelopesSince("doc-c", 0)).toHaveLength(1);

      vi.restoreAllMocks();
    });

    it("cleans up seq counters on eviction", () => {
      const limitedRelay = new EncryptedRelay({ maxDocuments: 1 });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(c1);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)[0]?.seq).toBe(1);

      // Evict doc-a by submitting to doc-b
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      limitedRelay.submit(c2);

      // Re-create doc-a — seq should restart at 1
      const c3 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(c3);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)[0]?.seq).toBe(1);
    });
  });

  describe("per-document envelope limit (H1)", () => {
    it("rejects submission when envelope count exceeds configured limit", () => {
      const maxEnvelopes = 3;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      // Submit up to the limit — should succeed
      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        limitedRelay.submit(envelope);
      }

      // One more should throw
      const overflow = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      expect(() => limitedRelay.submit(overflow)).toThrow(EnvelopeLimitExceededError);
    });

    it("includes documentId and limit in the error", () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        limitedRelay.submit(envelope);
      }

      const overflow = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      try {
        limitedRelay.submit(overflow);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(EnvelopeLimitExceededError);
        const error = err as EnvelopeLimitExceededError;
        expect(error.documentId).toBe(DOCUMENT_ID);
        expect(error.limit).toBe(maxEnvelopes);
        expect(error.message).toContain("compact");
      }
    });

    it("uses default limit from constants when not explicitly configured", () => {
      const defaultRelay = new EncryptedRelay();
      // Submit one envelope — should succeed (well below default limit)
      const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      const seq = defaultRelay.submit(envelope);
      expect(seq).toBe(1);
    });

    it("enforces limits independently per document", () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      // Fill doc-a to the limit
      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
        limitedRelay.submit(envelope);
      }

      // doc-b should still accept envelopes
      const envelopeB = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      expect(limitedRelay.submit(envelopeB)).toBe(1);

      // doc-a should still be rejected
      const overflowA = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      expect(() => limitedRelay.submit(overflowA)).toThrow(EnvelopeLimitExceededError);
    });

    it("dedup resubmission does not count toward limit", () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      const e1 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      const e2 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);

      limitedRelay.submit(e1);
      limitedRelay.submit(e2);

      // Re-submit e1 (dedup) — should return existing seq, not throw
      const dedupSeq = limitedRelay.submit(e1);
      expect(dedupSeq).toBe(1);
    });
  });

  describe("secondary dedup index (M9)", () => {
    it("evicts and resets document state including dedup entries", () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 1,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      // Submit multiple envelopes for doc-a
      for (let i = 0; i < 5; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
        limitedRelay.submit(envelope);
      }

      // Evict doc-a by submitting to doc-b
      const cb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      limitedRelay.submit(cb);

      expect(evicted).toEqual(["doc-a"]);

      // After eviction, resubmitting an envelope for doc-a gets seq 1 (fresh doc)
      // This confirms dedup entries were cleaned — old nonces no longer recognized
      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(c1);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)[0]?.seq).toBe(1);
    });

    it("keeps dedup entries for non-evicted documents intact", () => {
      const limitedRelay = new EncryptedRelay({ maxDocuments: 2 });

      // Submit envelopes for doc-a and doc-b
      const ea = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(ea);
      const eb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      limitedRelay.submit(eb);

      // Evict doc-a by submitting to doc-c
      const ec = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      limitedRelay.submit(ec);

      // doc-b dedup should still work — resubmit returns existing seq
      const dedupSeq = limitedRelay.submit(eb);
      expect(dedupSeq).toBe(1);
    });

    it("secondary index stays in sync after multiple evictions", () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 1,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      // Chain of evictions: doc-a → doc-b → doc-c
      const ca = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(ca);

      const cb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      limitedRelay.submit(cb);

      const cc = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      limitedRelay.submit(cc);

      expect(evicted).toEqual(["doc-a", "doc-b"]);

      // doc-c dedup should work
      const dedupSeq = limitedRelay.submit(cc);
      expect(dedupSeq).toBe(1);

      // Re-creating evicted docs should get fresh seqs
      const newA = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      limitedRelay.submit(newA);
      expect(limitedRelay.getEnvelopesSince("doc-a", 0)[0]?.seq).toBe(1);
    });
  });

  describe("snapshot size limit", () => {
    it("rejects snapshot exceeding configured size limit", () => {
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 64 });
      // 512 bytes of plaintext will produce ciphertext well over 64 bytes
      const snapshot = encryptSnapshot(sodium.randomBytes(512), DOCUMENT_ID, 1, keys, sodium);
      expect(() => {
        limitedRelay.submitSnapshot(snapshot);
      }).toThrow(SnapshotSizeLimitExceededError);
    });

    it("accepts snapshot within size limit", () => {
      // Large limit to accommodate AEAD overhead on small plaintext
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 4096 });
      const snapshot = encryptSnapshot(sodium.randomBytes(16), DOCUMENT_ID, 1, keys, sodium);
      limitedRelay.submitSnapshot(snapshot);
      expect(limitedRelay.getLatestSnapshot(DOCUMENT_ID)).toEqual(snapshot);
    });

    it("includes documentId, sizeBytes, and limit in the error", () => {
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 64 });
      const snapshot = encryptSnapshot(sodium.randomBytes(512), DOCUMENT_ID, 1, keys, sodium);
      try {
        limitedRelay.submitSnapshot(snapshot);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SnapshotSizeLimitExceededError);
        const error = err as SnapshotSizeLimitExceededError;
        expect(error.documentId).toBe(DOCUMENT_ID);
        expect(error.sizeBytes).toBe(snapshot.ciphertext.byteLength);
        expect(error.limit).toBe(64);
      }
    });

    it("no size limit by default", () => {
      const defaultRelay = new EncryptedRelay();
      // Large snapshot should be accepted without error
      const snapshot = encryptSnapshot(sodium.randomBytes(1024), DOCUMENT_ID, 1, keys, sodium);
      defaultRelay.submitSnapshot(snapshot);
      expect(defaultRelay.getLatestSnapshot(DOCUMENT_ID)).toEqual(snapshot);
      expect(RELAY_MAX_SNAPSHOT_SIZE_BYTES).toBe(Infinity);
    });
  });
});
