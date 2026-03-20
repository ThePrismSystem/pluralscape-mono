/**
 * Integration tests for PgSyncRelayService.
 *
 * Uses PGlite with real Drizzle queries to validate submit(), getEnvelopesSince(),
 * submitSnapshot(), getLatestSnapshot(), and getManifest().
 */
import { PGlite } from "@electric-sql/pglite";
import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { SNAPSHOT_VERSION_CONFLICT_MESSAGE } from "@pluralscape/sync";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createPgSyncTables,
  pgInsertAccount,
  pgInsertSystem,
} from "../../../../../packages/db/src/__tests__/helpers/pg-helpers.js";
import { PgSyncRelayService } from "../sync-relay.service.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";
import type { SyncDocType } from "@pluralscape/types";

// ── Helpers ──────────────────────────────────────────────────────────

function testNonce(fill = 0): AeadNonce {
  const bytes: unknown = new Uint8Array(AEAD_NONCE_BYTES).fill(fill);
  return bytes as AeadNonce;
}

function testPubkey(fill = 1): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}

function testSig(fill = 2): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

function makeEnvelope(documentId: string, nonceFill: number): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([0xde, 0xad, nonceFill]),
    nonce: testNonce(nonceFill),
    signature: testSig(),
    authorPublicKey: testPubkey(),
  };
}

function makeSnapshotEnvelope(
  documentId: string,
  version: number,
  lastSeq: number,
): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion: version,
    lastSeq,
    ciphertext: new Uint8Array([0xca, 0xfe, version]),
    nonce: testNonce(version),
    signature: testSig(),
    authorPublicKey: testPubkey(),
  };
}

// ── Test suite ───────────────────────────────────────────────────────

describe("PgSyncRelayService integration", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let relay: PgSyncRelayService;
  let systemId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    // Use drizzle without schema parameter to produce PgliteDatabase<Record<string, never>>
    // which is structurally compatible with PostgresJsDatabase<Record<string, never>>.
    db = drizzle(client);
    await createPgSyncTables(client);

    // Insert account → system prerequisite chain
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);

    relay = new PgSyncRelayService(db);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(syncSnapshots);
    await db.delete(syncChanges);
    await db.delete(syncDocuments);
  });

  /** Insert a sync document row so submit() etc. can reference it. */
  async function insertDocument(
    documentId: string,
    docType: SyncDocType = "system-core",
  ): Promise<void> {
    await db.insert(syncDocuments).values({
      documentId,
      systemId,
      docType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  describe("submit()", () => {
    it("returns incrementing seq for new changes", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      const seq1 = await relay.submit(makeEnvelope(docId, 1));
      const seq2 = await relay.submit(makeEnvelope(docId, 2));
      const seq3 = await relay.submit(makeEnvelope(docId, 3));

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it("duplicate (same authorPublicKey + nonce) returns original seq without burning a new one", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      const envelope = makeEnvelope(docId, 10);
      const seq1 = await relay.submit(envelope);
      const seq2 = await relay.submit(envelope); // same nonce + pubkey

      expect(seq1).toBe(1);
      expect(seq2).toBe(1); // should reuse the same seq

      // Submit a genuinely new change — should get seq 2, not 3
      const seq3 = await relay.submit(makeEnvelope(docId, 11));
      expect(seq3).toBe(2);
    });

    it("throws for non-existent document", async () => {
      await expect(relay.submit(makeEnvelope("nonexistent-doc_123", 1))).rejects.toThrow(
        "Document not found",
      );
    });
  });

  describe("getEnvelopesSince()", () => {
    it("returns changes with seq > sinceSeq in order; empty for no changes", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      // No changes yet
      const empty = await relay.getEnvelopesSince(docId, 0);
      expect(empty).toHaveLength(0);

      // Submit 3 changes
      await relay.submit(makeEnvelope(docId, 1));
      await relay.submit(makeEnvelope(docId, 2));
      await relay.submit(makeEnvelope(docId, 3));

      // Get all
      const all = await relay.getEnvelopesSince(docId, 0);
      expect(all).toHaveLength(3);
      const seqs = all.map((e) => e.seq);
      expect(seqs).toEqual([1, 2, 3]);

      // Get since seq 2 (exclusive)
      const after2 = await relay.getEnvelopesSince(docId, 2);
      expect(after2).toHaveLength(1);
      expect(after2.map((e) => e.seq)).toEqual([3]);
    });
  });

  describe("submitSnapshot()", () => {
    it("succeeds with version > current", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      await expect(
        relay.submitSnapshot(makeSnapshotEnvelope(docId, 1, 0)),
      ).resolves.toBeUndefined();
    });

    it("throws VERSION_CONFLICT for version <= current", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      await relay.submitSnapshot(makeSnapshotEnvelope(docId, 2, 5));

      await expect(relay.submitSnapshot(makeSnapshotEnvelope(docId, 1, 3))).rejects.toThrow(
        SNAPSHOT_VERSION_CONFLICT_MESSAGE,
      );

      await expect(relay.submitSnapshot(makeSnapshotEnvelope(docId, 2, 5))).rejects.toThrow(
        SNAPSHOT_VERSION_CONFLICT_MESSAGE,
      );
    });
  });

  describe("getLatestSnapshot()", () => {
    it("returns null when none exists", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      const result = await relay.getLatestSnapshot(docId);
      expect(result).toBeNull();
    });

    it("returns snapshot after submit", async () => {
      const docId = `system-core-${systemId}`;
      await insertDocument(docId);

      await relay.submitSnapshot(makeSnapshotEnvelope(docId, 1, 10));

      const result = await relay.getLatestSnapshot(docId);
      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
          snapshotVersion: 1,
          lastSeq: 10,
          documentId: docId,
        }),
      );
    });
  });

  describe("getManifest()", () => {
    it("returns correct docs for systemId; filters correctly", async () => {
      const docId1 = `system-core-${systemId}`;
      const docId2 = `fronting-${systemId}`;
      await insertDocument(docId1);
      await insertDocument(docId2, "fronting");

      const manifest = await relay.getManifest(systemId);
      expect(manifest.systemId).toBe(systemId);
      expect(manifest.documents).toHaveLength(2);
      expect(manifest.documents.map((d) => d.docId).sort()).toEqual([docId1, docId2].sort());

      // Different systemId returns empty
      const other = await relay.getManifest("sys_nonexistent");
      expect(other.documents).toHaveLength(0);
    });
  });
});
