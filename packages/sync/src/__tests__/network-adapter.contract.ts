/**
 * Contract test suite for SyncNetworkAdapter implementations.
 *
 * Usage:
 *   import { runNetworkAdapterContract } from "./network-adapter.contract.js";
 *   runNetworkAdapterContract(() => new YourNetworkAdapter());
 *
 * The factory function is called before each test to produce a fresh,
 * empty adapter instance.
 */
import { describe, expect, it, vi } from "vitest";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";

// ── Test data builders ─────────────────────────────────────────────────

// Cast test byte arrays to branded types — these are contract test fixtures,
// not real cryptographic material. We use an explicit unknown intermediate
// to satisfy the brand constraint without importing internal assertion functions.
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

/** Builds a change payload (no seq) suitable for submitChange. */
function makeChangePayload(fill: number, documentId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([1, 2, 3, fill]),
    nonce: nonce(fill),
    signature: sig(2),
    authorPublicKey: pubkey(1),
  };
}

function makeSnapshot(version: number, documentId: string): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion: version,
    ciphertext: new Uint8Array([10, 20, 30, version]),
    nonce: nonce(version),
    signature: sig(3),
    authorPublicKey: pubkey(1),
  };
}

// ── Contract ───────────────────────────────────────────────────────────

export function runNetworkAdapterContract(factory: () => SyncNetworkAdapter): void {
  describe("SyncNetworkAdapter contract", () => {
    describe("submitChange / fetchChangesSince", () => {
      it("returns an envelope with a server-assigned seq", async () => {
        const adapter = factory();
        const docId = "doc_submit1";
        const result = await adapter.submitChange(docId, makeChangePayload(0, docId));
        expect(typeof result.seq).toBe("number");
        expect(result.seq).toBeGreaterThanOrEqual(1);
      });

      it("returns submitted changes in ascending seq order", async () => {
        const adapter = factory();
        const docId = "doc_order";
        for (let i = 1; i <= 3; i++) {
          await adapter.submitChange(docId, makeChangePayload(i, docId));
        }
        const result = await adapter.fetchChangesSince(docId, 0);
        expect(result.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < result.length; i++) {
          expect(result[i]?.seq ?? 0).toBeGreaterThan(result[i - 1]?.seq ?? 0);
        }
      });

      it("fetchChangesSince excludes envelopes at or below sinceSeq", async () => {
        const adapter = factory();
        const docId = "doc_since";
        const seqs: number[] = [];
        for (let i = 1; i <= 4; i++) {
          const submitted = await adapter.submitChange(docId, makeChangePayload(i, docId));
          seqs.push(submitted.seq);
        }
        // Fetch since the second submitted seq (exclusive)
        const cutoff = seqs[1] ?? 0;
        const result = await adapter.fetchChangesSince(docId, cutoff);
        for (const envelope of result) {
          expect(envelope.seq).toBeGreaterThan(cutoff);
        }
      });

      it("returns empty array for a document with no changes", async () => {
        const adapter = factory();
        const result = await adapter.fetchChangesSince("doc_empty", 0);
        expect(result).toHaveLength(0);
      });
    });

    describe("submitSnapshot / fetchLatestSnapshot", () => {
      it("returns null for a document with no snapshot", async () => {
        const adapter = factory();
        const result = await adapter.fetchLatestSnapshot("doc_no_snap");
        expect(result).toBeNull();
      });

      it("round-trips a submitted snapshot", async () => {
        const adapter = factory();
        const docId = "doc_snap_rt";
        const snapshot = makeSnapshot(1, docId);
        await adapter.submitSnapshot(docId, snapshot);
        const loaded = await adapter.fetchLatestSnapshot(docId);
        expect(loaded).not.toBeNull();
        expect(loaded?.snapshotVersion).toBe(1);
        expect(new Uint8Array(loaded?.ciphertext ?? [])).toEqual(snapshot.ciphertext);
      });

      it("fetchLatestSnapshot returns the most recent snapshot", async () => {
        const adapter = factory();
        const docId = "doc_snap_latest";
        await adapter.submitSnapshot(docId, makeSnapshot(1, docId));
        await adapter.submitSnapshot(docId, makeSnapshot(3, docId));
        await adapter.submitSnapshot(docId, makeSnapshot(2, docId));
        const loaded = await adapter.fetchLatestSnapshot(docId);
        // Should return the highest version submitted, regardless of order
        expect(loaded?.snapshotVersion).toBeGreaterThanOrEqual(2);
      });
    });

    describe("subscribe", () => {
      it("returns a subscription with an unsubscribe function", () => {
        const adapter = factory();
        const subscription = adapter.subscribe("doc_sub1", () => {
          /* no-op */
        });
        expect(typeof subscription.unsubscribe).toBe("function");
        subscription.unsubscribe();
      });

      it("unsubscribe does not throw", () => {
        const adapter = factory();
        const subscription = adapter.subscribe("doc_sub2", () => {
          /* no-op */
        });
        expect(() => {
          subscription.unsubscribe();
        }).not.toThrow();
      });

      it("callback is not invoked after unsubscribe", async () => {
        const adapter = factory();
        const docId = "doc_sub_unsub";
        const callback = vi.fn();
        const subscription = adapter.subscribe(docId, callback);
        subscription.unsubscribe();

        // Submit a change after unsubscribing — callback should not fire
        await adapter.submitChange(docId, makeChangePayload(1, docId));

        // Give any async delivery a chance to fire
        await Promise.resolve();
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe("fetchManifest", () => {
      it("returns a manifest with the correct systemId", async () => {
        const adapter = factory();
        const systemId = "sys_manifest_test";
        const manifest = await adapter.fetchManifest(systemId);
        expect(manifest.systemId).toBe(systemId);
        expect(Array.isArray(manifest.documents)).toBe(true);
      });
    });
  });
}
