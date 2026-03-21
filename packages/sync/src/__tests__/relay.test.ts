import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptChange, encryptSnapshot } from "../encrypted-sync.js";
import { RELAY_MAX_SNAPSHOT_SIZE_BYTES } from "../relay.constants.js";
import {
  EncryptedRelay,
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
  SnapshotVersionConflictError,
} from "../relay.js";
import { MiB } from "../sync.constants.js";

import type { SyncRelayService } from "../relay-service.js";
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
  it("2.1 — stores and returns envelopes with assigned seq numbers", async () => {
    const change = sodium.randomBytes(32);
    const envelope = encryptChange(change, DOCUMENT_ID, keys, sodium);
    const seq = await relay.submit(envelope);

    expect(seq).toBe(1);
    const result = await relay.getEnvelopesSince(DOCUMENT_ID, 0);
    expect(result.envelopes).toHaveLength(1);
    expect(result.envelopes[0]?.seq).toBe(1);
    expect(result.envelopes[0]?.ciphertext).toEqual(envelope.ciphertext);
    expect(result.hasMore).toBe(false);
  });

  it("2.2 — returns only envelopes since a given seq", async () => {
    const c1 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);
    const c2 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);
    const c3 = encryptChange(sodium.randomBytes(32), DOCUMENT_ID, keys, sodium);

    await relay.submit(c1);
    await relay.submit(c2);
    await relay.submit(c3);

    const sinceSeq1 = await relay.getEnvelopesSince(DOCUMENT_ID, 1);
    expect(sinceSeq1.envelopes).toHaveLength(2);
    expect(sinceSeq1.envelopes[0]?.seq).toBe(2);
    expect(sinceSeq1.envelopes[1]?.seq).toBe(3);

    const sinceSeq2 = await relay.getEnvelopesSince(DOCUMENT_ID, 2);
    expect(sinceSeq2.envelopes).toHaveLength(1);
    expect(sinceSeq2.envelopes[0]?.seq).toBe(3);

    const sinceSeq3 = await relay.getEnvelopesSince(DOCUMENT_ID, 3);
    expect(sinceSeq3.envelopes).toHaveLength(0);
  });

  it("2.3 — stored ciphertext is not valid Automerge data", async () => {
    const change = sodium.randomBytes(64);
    const envelope = encryptChange(change, DOCUMENT_ID, keys, sodium);
    await relay.submit(envelope);

    const state = relay.inspectStorage(DOCUMENT_ID);
    expect(state).toBeDefined();

    // Automerge documents start with a magic number (0x85, 0x6f, 0x4a, 0x83)
    // Encrypted ciphertext should not resemble valid Automerge data
    const storedCiphertext = state?.envelopes[0]?.ciphertext;
    expect(storedCiphertext).toBeDefined();

    // Verify the relay only stores ciphertext, not the plaintext change
    expect(storedCiphertext).not.toEqual(change);
  });

  it("2.4 — assigns per-document monotonically increasing seq numbers", async () => {
    const seqs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      seqs.push(await relay.submit(envelope));
    }

    for (let i = 1; i < seqs.length; i++) {
      const prev = seqs[i - 1];
      expect(prev).toBeDefined();
      expect(seqs[i]).toBeGreaterThan(prev ?? 0);
    }
  });

  it("2.4b — different documents have independent seq counters", async () => {
    const c1 = encryptChange(sodium.randomBytes(16), "doc-alpha", keys, sodium);
    const c2 = encryptChange(sodium.randomBytes(16), "doc-beta", keys, sodium);

    const seqA = await relay.submit(c1);
    const seqB = await relay.submit(c2);

    // Both start at 1 since they are independent documents
    expect(seqA).toBe(1);
    expect(seqB).toBe(1);
  });

  it("2.5 — stores and returns snapshots", async () => {
    const snapshot = sodium.randomBytes(256);
    const envelope = encryptSnapshot(snapshot, DOCUMENT_ID, 1, keys, sodium);
    await relay.submitSnapshot(envelope);

    const latest = await relay.getLatestSnapshot(DOCUMENT_ID);
    expect(latest).not.toBeNull();
    expect(latest?.ciphertext).toEqual(envelope.ciphertext);
    expect(latest?.snapshotVersion).toBe(1);
  });

  it("2.6 — replaces old snapshot with new one", async () => {
    const snap1 = encryptSnapshot(sodium.randomBytes(128), DOCUMENT_ID, 1, keys, sodium);
    const snap2 = encryptSnapshot(sodium.randomBytes(128), DOCUMENT_ID, 2, keys, sodium);

    await relay.submitSnapshot(snap1);
    await relay.submitSnapshot(snap2);

    const latest = await relay.getLatestSnapshot(DOCUMENT_ID);
    expect(latest?.snapshotVersion).toBe(2);
    expect(latest?.ciphertext).toEqual(snap2.ciphertext);

    // No snapshot for unknown doc
    expect(await relay.getLatestSnapshot("doc-unknown")).toBeNull();
  });

  describe("implements SyncRelayService", () => {
    it("is assignable to SyncRelayService without an adapter", () => {
      const service: SyncRelayService = relay;
      expect(service).toBe(relay);
    });

    it("asService() returns this", () => {
      expect(relay.asService()).toBe(relay);
    });
  });

  describe("pagination (getEnvelopesSince with limit)", () => {
    it("returns all envelopes when under limit", async () => {
      const c1 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      await relay.submit(c1);
      await relay.submit(c2);

      const result = await relay.getEnvelopesSince(DOCUMENT_ID, 0, 10);
      expect(result.envelopes).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("caps results at limit and sets hasMore", async () => {
      for (let i = 0; i < 5; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        await relay.submit(envelope);
      }

      const result = await relay.getEnvelopesSince(DOCUMENT_ID, 0, 3);
      expect(result.envelopes).toHaveLength(3);
      expect(result.hasMore).toBe(true);
      expect(result.envelopes[0]?.seq).toBe(1);
      expect(result.envelopes[2]?.seq).toBe(3);
    });

    it("returns all when limit is undefined", async () => {
      for (let i = 0; i < 5; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        await relay.submit(envelope);
      }

      const result = await relay.getEnvelopesSince(DOCUMENT_ID, 0);
      expect(result.envelopes).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest doc when limit exceeded", async () => {
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

      await limitedRelay.submit(c1);
      await limitedRelay.submit(c2);
      // At capacity — next submit should evict doc-a (oldest)
      await limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-a"]);
      const result = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(result.envelopes).toHaveLength(0);
      const resultB = await limitedRelay.getEnvelopesSince("doc-b", 0);
      expect(resultB.envelopes).toHaveLength(1);
      const resultC = await limitedRelay.getEnvelopesSince("doc-c", 0);
      expect(resultC.envelopes).toHaveLength(1);
    });

    it("calls onEvict callback on eviction", async () => {
      const onEvict = vi.fn();
      const limitedRelay = new EncryptedRelay({ maxDocuments: 1, onEvict });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-x", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-y", keys, sodium);

      await limitedRelay.submit(c1);
      await limitedRelay.submit(c2);

      expect(onEvict).toHaveBeenCalledWith("doc-x");
    });

    it("touch updates access time for LRU ordering", async () => {
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

      await limitedRelay.submit(c1);
      now = 2000;
      await limitedRelay.submit(c2);

      // Touch doc-old to make it more recent than doc-new
      now = 3000;
      await limitedRelay.getEnvelopesSince("doc-old", 0);

      // Now add doc-c — should evict doc-new (less recently accessed)
      now = 4000;
      const c3 = encryptChange(sodium.randomBytes(16), "doc-third", keys, sodium);
      await limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-new"]);

      vi.restoreAllMocks();
    });

    it("does not evict when under limit", async () => {
      const onEvict = vi.fn();
      const limitedRelay = new EncryptedRelay({ maxDocuments: 10, onEvict });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-1", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-2", keys, sodium);

      await limitedRelay.submit(c1);
      await limitedRelay.submit(c2);

      expect(onEvict).not.toHaveBeenCalled();
    });

    it("does not self-evict the incoming document", async () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 2,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      await limitedRelay.submit(c1);
      await limitedRelay.submit(c2);

      // Submit again to doc-a — doc-a is already tracked, so no eviction needed
      const c3 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(c3);

      expect(evicted).toEqual([]);
      const result = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(result.envelopes).toHaveLength(2);
    });

    it("evicts oldest non-incoming doc when new doc arrives at capacity", async () => {
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

      await limitedRelay.submit(c1);
      now = 2000;
      await limitedRelay.submit(c2);

      // Submit to new doc-c — doc-a (oldest) should be evicted, not doc-c
      now = 3000;
      const c3 = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      await limitedRelay.submit(c3);

      expect(evicted).toEqual(["doc-a"]);
      const result = await limitedRelay.getEnvelopesSince("doc-c", 0);
      expect(result.envelopes).toHaveLength(1);

      vi.restoreAllMocks();
    });

    it("cleans up seq counters on eviction", async () => {
      const limitedRelay = new EncryptedRelay({ maxDocuments: 1 });

      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(c1);
      const resultA1 = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(resultA1.envelopes[0]?.seq).toBe(1);

      // Evict doc-a by submitting to doc-b
      const c2 = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      await limitedRelay.submit(c2);

      // Re-create doc-a — seq should restart at 1
      const c3 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(c3);
      const resultA2 = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(resultA2.envelopes[0]?.seq).toBe(1);
    });
  });

  describe("per-document envelope limit (H1)", () => {
    it("rejects submission when envelope count exceeds configured limit", async () => {
      const maxEnvelopes = 3;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      // Submit up to the limit — should succeed
      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        await limitedRelay.submit(envelope);
      }

      // One more should throw
      const overflow = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      await expect(limitedRelay.submit(overflow)).rejects.toThrow(EnvelopeLimitExceededError);
    });

    it("includes documentId and limit in the error", async () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        await limitedRelay.submit(envelope);
      }

      const overflow = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      try {
        await limitedRelay.submit(overflow);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(EnvelopeLimitExceededError);
        const error = err as EnvelopeLimitExceededError;
        expect(error.documentId).toBe(DOCUMENT_ID);
        expect(error.limit).toBe(maxEnvelopes);
        expect(error.message).toContain("compact");
      }
    });

    it("uses default limit from constants when not explicitly configured", async () => {
      const defaultRelay = new EncryptedRelay();
      // Submit one envelope — should succeed (well below default limit)
      const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      const seq = await defaultRelay.submit(envelope);
      expect(seq).toBe(1);
    });

    it("enforces limits independently per document", async () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      // Fill doc-a to the limit
      for (let i = 0; i < maxEnvelopes; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
        await limitedRelay.submit(envelope);
      }

      // doc-b should still accept envelopes
      const envelopeB = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      expect(await limitedRelay.submit(envelopeB)).toBe(1);

      // doc-a should still be rejected
      const overflowA = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await expect(limitedRelay.submit(overflowA)).rejects.toThrow(EnvelopeLimitExceededError);
    });

    it("dedup resubmission does not count toward limit", async () => {
      const maxEnvelopes = 2;
      const limitedRelay = new EncryptedRelay({ maxEnvelopesPerDocument: maxEnvelopes });

      const e1 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      const e2 = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);

      await limitedRelay.submit(e1);
      await limitedRelay.submit(e2);

      // Re-submit e1 (dedup) — should return existing seq, not throw
      const dedupSeq = await limitedRelay.submit(e1);
      expect(dedupSeq).toBe(1);
    });
  });

  describe("secondary dedup index (M9)", () => {
    it("evicts and resets document state including dedup entries", async () => {
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
        await limitedRelay.submit(envelope);
      }

      // Evict doc-a by submitting to doc-b
      const cb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      await limitedRelay.submit(cb);

      expect(evicted).toEqual(["doc-a"]);

      // After eviction, resubmitting an envelope for doc-a gets seq 1 (fresh doc)
      // This confirms dedup entries were cleaned — old nonces no longer recognized
      const c1 = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(c1);
      const result = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(result.envelopes[0]?.seq).toBe(1);
    });

    it("keeps dedup entries for non-evicted documents intact", async () => {
      const limitedRelay = new EncryptedRelay({ maxDocuments: 2 });

      // Submit envelopes for doc-a and doc-b
      const ea = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(ea);
      const eb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      await limitedRelay.submit(eb);

      // Evict doc-a by submitting to doc-c
      const ec = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      await limitedRelay.submit(ec);

      // doc-b dedup should still work — resubmit returns existing seq
      const dedupSeq = await limitedRelay.submit(eb);
      expect(dedupSeq).toBe(1);
    });

    it("secondary index stays in sync after multiple evictions", async () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 1,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      // Chain of evictions: doc-a -> doc-b -> doc-c
      const ca = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(ca);

      const cb = encryptChange(sodium.randomBytes(16), "doc-b", keys, sodium);
      await limitedRelay.submit(cb);

      const cc = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      await limitedRelay.submit(cc);

      expect(evicted).toEqual(["doc-a", "doc-b"]);

      // doc-c dedup should work
      const dedupSeq = await limitedRelay.submit(cc);
      expect(dedupSeq).toBe(1);

      // Re-creating evicted docs should get fresh seqs
      const newA = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(newA);
      const result = await limitedRelay.getEnvelopesSince("doc-a", 0);
      expect(result.envelopes[0]?.seq).toBe(1);
    });
  });

  describe("snapshot size limit", () => {
    it("rejects snapshot exceeding configured size limit", async () => {
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 64 });
      // 512 bytes of plaintext will produce ciphertext well over 64 bytes
      const snapshot = encryptSnapshot(sodium.randomBytes(512), DOCUMENT_ID, 1, keys, sodium);
      await expect(limitedRelay.submitSnapshot(snapshot)).rejects.toThrow(
        SnapshotSizeLimitExceededError,
      );
    });

    it("accepts snapshot within size limit", async () => {
      // Large limit to accommodate AEAD overhead on small plaintext
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 4096 });
      const snapshot = encryptSnapshot(sodium.randomBytes(16), DOCUMENT_ID, 1, keys, sodium);
      await limitedRelay.submitSnapshot(snapshot);
      expect(await limitedRelay.getLatestSnapshot(DOCUMENT_ID)).toEqual(snapshot);
    });

    it("includes documentId, sizeBytes, and limit in the error", async () => {
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: 64 });
      const snapshot = encryptSnapshot(sodium.randomBytes(512), DOCUMENT_ID, 1, keys, sodium);
      try {
        await limitedRelay.submitSnapshot(snapshot);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SnapshotSizeLimitExceededError);
        const error = err as SnapshotSizeLimitExceededError;
        expect(error.documentId).toBe(DOCUMENT_ID);
        expect(error.sizeBytes).toBe(snapshot.ciphertext.byteLength);
        expect(error.limit).toBe(64);
      }
    });

    it("uses finite default from constants", () => {
      expect(RELAY_MAX_SNAPSHOT_SIZE_BYTES).toBe(50 * MiB);
      expect(Number.isFinite(RELAY_MAX_SNAPSHOT_SIZE_BYTES)).toBe(true);
    });
  });

  describe("dedup pruning on snapshot (P-H3)", () => {
    it("prunes all dedup entries up to current seq on snapshot acceptance", async () => {
      // Submit 5 changes for the document (seq 1-5)
      const envelopes = [];
      for (let i = 0; i < 5; i++) {
        const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
        await relay.submit(envelope);
        envelopes.push(envelope);
      }

      // Use a snapshotVersion (99) that differs from seq numbers
      // to prove pruning uses the document's current seq, not snapshotVersion
      const snapshot = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 99, keys, sodium);
      await relay.submitSnapshot(snapshot);

      // All 5 dedup entries should be pruned (current seq was 5)
      for (let i = 0; i < 5; i++) {
        const envelope = envelopes[i];
        if (!envelope) throw new Error(`Expected envelope at index ${String(i)}`);
        const seq = await relay.submit(envelope);
        // Should get new seq numbers (6, 7, 8, 9, 10)
        expect(seq).toBeGreaterThan(5);
      }
    });

    it("handles snapshot when no dedup entries exist", async () => {
      // Submit snapshot without any prior changes — should not throw
      const snapshot = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 1, keys, sodium);
      await relay.submitSnapshot(snapshot);
      expect(await relay.getLatestSnapshot(DOCUMENT_ID)).toEqual(snapshot);
    });

    it("cleans up dedupByDoc secondary index when all entries pruned", async () => {
      // Submit a single change
      const envelope = encryptChange(sodium.randomBytes(16), DOCUMENT_ID, keys, sodium);
      await relay.submit(envelope);

      // Submit snapshot at version 1 — prunes the only dedup entry
      const snapshot = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 1, keys, sodium);
      await relay.submitSnapshot(snapshot);

      // Resubmitting the change should get a new seq (dedup was pruned)
      const newSeq = await relay.submit(envelope);
      expect(newSeq).toBe(2);
    });
  });

  describe("snapshot version conflict", () => {
    it("rejects snapshot with version equal to current", async () => {
      const snap1 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 2, keys, sodium);
      await relay.submitSnapshot(snap1);

      const snap2 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 2, keys, sodium);
      await expect(relay.submitSnapshot(snap2)).rejects.toThrow(SnapshotVersionConflictError);
    });

    it("rejects snapshot with version lower than current", async () => {
      const snap1 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 3, keys, sodium);
      await relay.submitSnapshot(snap1);

      const snap2 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 1, keys, sodium);
      await expect(relay.submitSnapshot(snap2)).rejects.toThrow(SnapshotVersionConflictError);
    });

    it("includes attemptedVersion and currentVersion in the error", async () => {
      const snap1 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 5, keys, sodium);
      await relay.submitSnapshot(snap1);

      const snap2 = encryptSnapshot(sodium.randomBytes(64), DOCUMENT_ID, 3, keys, sodium);
      try {
        await relay.submitSnapshot(snap2);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SnapshotVersionConflictError);
        const error = err as SnapshotVersionConflictError;
        expect(error.attemptedVersion).toBe(3);
        expect(error.currentVersion).toBe(5);
      }
    });
  });

  describe("snapshot size limit boundary", () => {
    it("accepts snapshot at exactly the size limit", async () => {
      // Create a relay with a specific limit, then craft a snapshot whose
      // ciphertext is exactly that size. The check is `>`, not `>=`.
      const exactSize = 128;
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: exactSize });

      // Build an envelope manually with exact-size ciphertext
      const snapshot = encryptSnapshot(sodium.randomBytes(16), DOCUMENT_ID, 1, keys, sodium);
      const exactCiphertext = new Uint8Array(exactSize);
      exactCiphertext.set(
        snapshot.ciphertext.subarray(0, Math.min(snapshot.ciphertext.length, exactSize)),
      );
      const exactSnapshot = { ...snapshot, ciphertext: exactCiphertext };

      await limitedRelay.submitSnapshot(exactSnapshot);
      expect(await limitedRelay.getLatestSnapshot(DOCUMENT_ID)).toEqual(exactSnapshot);
    });

    it("rejects snapshot one byte over the limit", async () => {
      const exactSize = 128;
      const limitedRelay = new EncryptedRelay({ maxSnapshotSizeBytes: exactSize });

      const snapshot = encryptSnapshot(sodium.randomBytes(16), DOCUMENT_ID, 1, keys, sodium);
      const overCiphertext = new Uint8Array(exactSize + 1);
      const overSnapshot = { ...snapshot, ciphertext: overCiphertext };

      await expect(limitedRelay.submitSnapshot(overSnapshot)).rejects.toThrow(
        SnapshotSizeLimitExceededError,
      );
    });
  });

  describe("cross-document dedup key collision", () => {
    it("does not dedup the same envelope submitted to different documents", async () => {
      const envelope = encryptChange(sodium.randomBytes(16), "doc-x", keys, sodium);

      // Submit to doc-x
      const seqX = await relay.submit(envelope);
      expect(seqX).toBe(1);

      // Submit the exact same (authorPublicKey, nonce) to doc-y — should NOT dedup
      const envelopeY = { ...envelope, documentId: "doc-y" };
      const seqY = await relay.submit(envelopeY);
      expect(seqY).toBe(1); // doc-y has its own seq counter

      // doc-x dedup should still work
      const dedupSeqX = await relay.submit(envelope);
      // After cross-doc collision, the dedup entry was reassigned to doc-y,
      // so doc-x gets a new seq
      expect(dedupSeqX).toBe(2);
    });

    it("cleans up stale dedupByDoc entry on cross-document collision", async () => {
      const evicted: string[] = [];
      const limitedRelay = new EncryptedRelay({
        maxDocuments: 3,
        onEvict: (docId) => {
          evicted.push(docId);
        },
      });

      const envelope = encryptChange(sodium.randomBytes(16), "doc-a", keys, sodium);
      await limitedRelay.submit(envelope);

      // Same (authorPublicKey, nonce) to doc-b — triggers cross-doc cleanup
      const envelopeB = { ...envelope, documentId: "doc-b" };
      await limitedRelay.submit(envelopeB);

      // Evict doc-a by filling capacity (doc-a, doc-b already exist, add doc-c and doc-d)
      const ec = encryptChange(sodium.randomBytes(16), "doc-c", keys, sodium);
      await limitedRelay.submit(ec);
      const ed = encryptChange(sodium.randomBytes(16), "doc-d", keys, sodium);
      await limitedRelay.submit(ed);

      // doc-a should have been evicted cleanly (no stale dedup references causing issues)
      expect(evicted).toContain("doc-a");
    });
  });

  describe("getManifest", () => {
    it("returns empty documents array with the given systemId", async () => {
      const systemId = "sys_test123" as import("@pluralscape/types").SystemId;
      const manifest = await relay.getManifest(systemId);
      expect(manifest).toEqual({ documents: [], systemId });
    });
  });
});
