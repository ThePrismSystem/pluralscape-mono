/**
 * PgSyncRelayService integration tests.
 *
 * Uses PGlite to run against a real PostgreSQL engine (in-process).
 * Validates submit, idempotent retry, getEnvelopesSince, snapshots,
 * and manifest retrieval.
 */
import { PGlite } from "@electric-sql/pglite";
import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { SNAPSHOT_VERSION_CONFLICT_MESSAGE } from "@pluralscape/sync";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPgSyncTables, pgInsertAccount, pgInsertSystem } from "@pluralscape/db/test-helpers";

import { PgSyncRelayService } from "../sync-relay.service.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { syncDocuments, syncChanges, syncSnapshots };

describe("PgSyncRelayService", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let relay: PgSyncRelayService;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSyncTables(client);
    // PgSyncRelayService accepts PostgresJsDatabase but PGlite is compatible at runtime
    relay = new PgSyncRelayService(db as never);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(syncSnapshots);
    await db.delete(syncChanges);
    await db.delete(syncDocuments);
  });

  async function createDocument(systemId: string, documentId?: string): Promise<string> {
    const docId = documentId ?? crypto.randomUUID();
    const now = Date.now();
    await db.insert(syncDocuments).values({
      documentId: docId,
      systemId,
      docType: "system-core",
      createdAt: now,
      updatedAt: now,
    });
    return docId;
  }

  function makeEnvelope(documentId: string, nonceByte = 0x01) {
    return {
      documentId,
      ciphertext: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      authorPublicKey: new Uint8Array(32).fill(0x01),
      nonce: new Uint8Array(24).fill(nonceByte),
      signature: new Uint8Array(64).fill(0x03),
    };
  }

  describe("submit", () => {
    it("returns server-assigned seq and increments atomically", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      const seq1 = await relay.submit(makeEnvelope(docId, 0x01));
      const seq2 = await relay.submit(makeEnvelope(docId, 0x02));

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it("idempotent retry returns existing seq", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      const envelope = makeEnvelope(docId, 0x10);
      const seq1 = await relay.submit(envelope);
      const seq2 = await relay.submit(envelope);

      expect(seq1).toBe(seq2);
    });

    it("throws for missing document", async () => {
      await expect(relay.submit(makeEnvelope("nonexistent-doc"))).rejects.toThrow(
        "Document not found",
      );
    });
  });

  describe("getEnvelopesSince", () => {
    it("returns changes in ascending seq order, respects sinceSeq", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      await relay.submit(makeEnvelope(docId, 0x01));
      await relay.submit(makeEnvelope(docId, 0x02));
      await relay.submit(makeEnvelope(docId, 0x03));

      const all = await relay.getEnvelopesSince(docId, 0);
      expect(all).toHaveLength(3);
      expect(all[0]?.seq).toBe(1);
      expect(all[1]?.seq).toBe(2);
      expect(all[2]?.seq).toBe(3);

      const since1 = await relay.getEnvelopesSince(docId, 1);
      expect(since1).toHaveLength(2);
      expect(since1[0]?.seq).toBe(2);
    });

    it("respects limit parameter", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      await relay.submit(makeEnvelope(docId, 0x01));
      await relay.submit(makeEnvelope(docId, 0x02));
      await relay.submit(makeEnvelope(docId, 0x03));

      const limited = await relay.getEnvelopesSince(docId, 0, 2);
      expect(limited).toHaveLength(2);
      expect(limited[0]?.seq).toBe(1);
      expect(limited[1]?.seq).toBe(2);
    });
  });

  describe("submitSnapshot", () => {
    it("stores snapshot and updates document metadata", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      await relay.submitSnapshot({
        documentId: docId,
        ciphertext: new Uint8Array([0xca, 0xfe]),
        authorPublicKey: new Uint8Array(32).fill(0x02),
        nonce: new Uint8Array(24).fill(0xaa),
        signature: new Uint8Array(64).fill(0x04),
        snapshotVersion: 5,
      });

      const snapshot = await relay.getLatestSnapshot(docId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.snapshotVersion).toBe(5);
      expect(snapshot?.ciphertext).toEqual(new Uint8Array([0xca, 0xfe]));
    });

    it("throws VERSION_CONFLICT for same or older version", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      await relay.submitSnapshot({
        documentId: docId,
        ciphertext: new Uint8Array([0x01]),
        authorPublicKey: new Uint8Array(32).fill(0x01),
        nonce: new Uint8Array(24).fill(0x01),
        signature: new Uint8Array(64).fill(0x01),
        snapshotVersion: 3,
      });

      await expect(
        relay.submitSnapshot({
          documentId: docId,
          ciphertext: new Uint8Array([0x02]),
          authorPublicKey: new Uint8Array(32).fill(0x02),
          nonce: new Uint8Array(24).fill(0x02),
          signature: new Uint8Array(64).fill(0x02),
          snapshotVersion: 2,
        }),
      ).rejects.toThrow(SNAPSHOT_VERSION_CONFLICT_MESSAGE);
    });
  });

  describe("getLatestSnapshot", () => {
    it("returns null when no snapshot exists", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      const snapshot = await relay.getLatestSnapshot(docId);
      expect(snapshot).toBeNull();
    });

    it("returns snapshot after submit", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId = await createDocument(systemId);

      await relay.submitSnapshot({
        documentId: docId,
        ciphertext: new Uint8Array([0xbe, 0xef]),
        authorPublicKey: new Uint8Array(32).fill(0x03),
        nonce: new Uint8Array(24).fill(0xbb),
        signature: new Uint8Array(64).fill(0x05),
        snapshotVersion: 1,
      });

      const snapshot = await relay.getLatestSnapshot(docId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.documentId).toBe(docId);
      expect(snapshot?.snapshotVersion).toBe(1);
    });
  });

  describe("getManifest", () => {
    it("returns all documents for systemId with correct field mapping", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const docId1 = await createDocument(systemId);
      const docId2 = await createDocument(systemId);

      const manifest = await relay.getManifest(systemId);

      expect(manifest.systemId).toBe(systemId);
      expect(manifest.documents).toHaveLength(2);

      const docIds = manifest.documents.map((d) => d.docId);
      expect(docIds).toContain(docId1);
      expect(docIds).toContain(docId2);

      const doc = manifest.documents.find((d) => d.docId === docId1);
      expect(doc?.docType).toBe("system-core");
      expect(doc?.keyType).toBe("derived");
      expect(doc?.archived).toBe(false);
      expect(doc?.sizeBytes).toBe(0);
      expect(doc?.snapshotVersion).toBe(0);
      expect(typeof doc?.createdAt).toBe("number");
      expect(typeof doc?.updatedAt).toBe("number");
    });
  });
});
