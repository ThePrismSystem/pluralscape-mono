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

import { docId, makeSnapshot, nonce, pubkey, sig, sysId } from "./test-crypto-helpers.js";

import type { SyncNetworkAdapter } from "../adapters/network-adapter.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

// ── Test data builders ─────────────────────────────────────────────────

/** Builds a change payload (no seq) suitable for submitChange. */
function makeChangePayload(
  fill: number,
  documentId: SyncDocumentId,
): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([1, 2, 3, fill]),
    nonce: nonce(fill),
    signature: sig(2),
    authorPublicKey: pubkey(1),
  };
}

// ── Contract ───────────────────────────────────────────────────────────

export function runNetworkAdapterContract(factory: () => SyncNetworkAdapter): void {
  describe("SyncNetworkAdapter contract", () => {
    describe("submitChange / fetchChangesSince", () => {
      it("returns an envelope with a server-assigned seq", async () => {
        const adapter = factory();
        const testDocId = docId("doc_submit1");
        const result = await adapter.submitChange(testDocId, makeChangePayload(0, testDocId));
        expect(typeof result.seq).toBe("number");
        expect(result.seq).toBeGreaterThanOrEqual(1);
      });

      it("returns submitted changes in ascending seq order", async () => {
        const adapter = factory();
        const testDocId = docId("doc_order");
        for (let i = 1; i <= 3; i++) {
          await adapter.submitChange(testDocId, makeChangePayload(i, testDocId));
        }
        const result = await adapter.fetchChangesSince(testDocId, 0);
        expect(result.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < result.length; i++) {
          expect(result[i]?.seq ?? 0).toBeGreaterThan(result[i - 1]?.seq ?? 0);
        }
      });

      it("fetchChangesSince excludes envelopes at or below sinceSeq", async () => {
        const adapter = factory();
        const testDocId = docId("doc_since");
        const seqs: number[] = [];
        for (let i = 1; i <= 4; i++) {
          const submitted = await adapter.submitChange(testDocId, makeChangePayload(i, testDocId));
          seqs.push(submitted.seq);
        }
        // Fetch since the second submitted seq (exclusive)
        const cutoff = seqs[1] ?? 0;
        const result = await adapter.fetchChangesSince(testDocId, cutoff);
        for (const envelope of result) {
          expect(envelope.seq).toBeGreaterThan(cutoff);
        }
      });

      it("returns empty array for a document with no changes", async () => {
        const adapter = factory();
        const result = await adapter.fetchChangesSince(docId("doc_empty"), 0);
        expect(result).toHaveLength(0);
      });
    });

    describe("submitSnapshot / fetchLatestSnapshot", () => {
      it("returns null for a document with no snapshot", async () => {
        const adapter = factory();
        const result = await adapter.fetchLatestSnapshot(docId("doc_no_snap"));
        expect(result).toBeNull();
      });

      it("round-trips a submitted snapshot", async () => {
        const adapter = factory();
        const testDocId = docId("doc_snap_rt");
        const snapshot = makeSnapshot(1, testDocId);
        await adapter.submitSnapshot(testDocId, snapshot);
        const loaded = await adapter.fetchLatestSnapshot(testDocId);
        expect(loaded).not.toBeNull();
        expect(loaded?.snapshotVersion).toBe(1);
        expect(new Uint8Array(loaded?.ciphertext ?? [])).toEqual(snapshot.ciphertext);
      });

      it("fetchLatestSnapshot returns the most recent snapshot", async () => {
        const adapter = factory();
        const testDocId = docId("doc_snap_latest");
        await adapter.submitSnapshot(testDocId, makeSnapshot(1, testDocId));
        await adapter.submitSnapshot(testDocId, makeSnapshot(3, testDocId));
        await adapter.submitSnapshot(testDocId, makeSnapshot(2, testDocId));
        const loaded = await adapter.fetchLatestSnapshot(testDocId);
        // Should return the highest version submitted, regardless of order
        expect(loaded?.snapshotVersion).toBe(3);
      });
    });

    describe("subscribe", () => {
      it("returns a subscription with an unsubscribe function", () => {
        const adapter = factory();
        const subscription = adapter.subscribe(docId("doc_sub1"), () => {
          /* no-op */
        });
        expect(typeof subscription.unsubscribe).toBe("function");
        subscription.unsubscribe();
      });

      it("unsubscribe does not throw", () => {
        const adapter = factory();
        const subscription = adapter.subscribe(docId("doc_sub2"), () => {
          /* no-op */
        });
        expect(() => {
          subscription.unsubscribe();
        }).not.toThrow();
      });

      it("callback is not invoked after unsubscribe", async () => {
        const adapter = factory();
        const testDocId = docId("doc_sub_unsub");
        const callback = vi.fn();
        const subscription = adapter.subscribe(testDocId, callback);
        subscription.unsubscribe();

        // Submit a change after unsubscribing — callback should not fire
        await adapter.submitChange(testDocId, makeChangePayload(1, testDocId));

        // Give any async delivery a chance to fire
        await Promise.resolve();
        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe("fetchManifest", () => {
      it("returns a manifest with the correct systemId", async () => {
        const adapter = factory();
        const systemId = sysId("sys_manifest_test");
        const manifest = await adapter.fetchManifest(systemId);
        expect(manifest.systemId).toBe(systemId);
        expect(Array.isArray(manifest.documents)).toBe(true);
      });
    });
  });
}
