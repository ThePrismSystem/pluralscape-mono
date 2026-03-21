import { PGlite } from "@electric-sql/pglite";
import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { SnapshotVersionConflictError } from "@pluralscape/sync";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PgSyncRelayService } from "../../services/sync-relay.service.js";
import { makeEnvelope, makeSnapshotEnvelope, nonce } from "../helpers/crypto-test-fixtures.js";

import type { SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ── DDL ─────────────────────────────────────────────────────────────────

const DDL = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(255) PRIMARY KEY,
    email_hash VARCHAR(255) NOT NULL,
    email_salt VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    kdf_salt VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS systems (
    id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_documents (
    document_id VARCHAR(512) PRIMARY KEY,
    system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    snapshot_version INTEGER NOT NULL DEFAULT 0,
    last_seq INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT false,
    time_period VARCHAR(50),
    key_type VARCHAR(50) NOT NULL DEFAULT 'derived',
    bucket_id VARCHAR(255),
    channel_id VARCHAR(255),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sync_documents_system_id_idx ON sync_documents(system_id)`,
  `CREATE TABLE IF NOT EXISTS sync_changes (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(512) NOT NULL REFERENCES sync_documents(document_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    author_public_key BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sync_changes_document_id_seq_idx ON sync_changes(document_id, seq)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sync_changes_dedup_idx ON sync_changes(document_id, author_public_key, nonce)`,
  `CREATE TABLE IF NOT EXISTS sync_snapshots (
    document_id VARCHAR(512) PRIMARY KEY REFERENCES sync_documents(document_id) ON DELETE CASCADE,
    snapshot_version INTEGER NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    author_public_key BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    created_at BIGINT NOT NULL
  )`,
];

// ── Helpers ──────────────────────────────────────────────────────────────

const schema = { syncDocuments, syncChanges, syncSnapshots };

// ── Tests ────────────────────────────────────────────────────────────────

describe("PgSyncRelayService (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let service: PgSyncRelayService;
  let systemId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    for (const stmt of DDL) {
      await client.exec(stmt);
    }

    // Seed account + system
    const accountId = crypto.randomUUID();
    systemId = `sys_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();
    await client.exec(
      `INSERT INTO accounts (id, email_hash, email_salt, password_hash, kdf_salt, created_at, updated_at)
       VALUES ('${accountId}', 'hash', 'salt', 'pw', 'kdf', ${String(now)}, ${String(now)})`,
    );
    await client.exec(
      `INSERT INTO systems (id, account_id, created_at, updated_at)
       VALUES ('${systemId}', '${accountId}', ${String(now)}, ${String(now)})`,
    );

    service = new PgSyncRelayService(db as never);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(syncSnapshots);
    await db.delete(syncChanges);
    await db.delete(syncDocuments);
  });

  /** Insert a sync document row and return its documentId. */
  async function insertDoc(docId?: string): Promise<string> {
    const id = docId ?? `system-core-sys_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();
    await db.insert(syncDocuments).values({
      documentId: id,
      systemId,
      docType: "system-core",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  describe("submit", () => {
    it("inserts changes and returns incrementing seq", async () => {
      const docId = await insertDoc();
      const seq1 = await service.submit(makeEnvelope(docId));
      const seq2 = await service.submit({
        ...makeEnvelope(docId),
        nonce: nonce(0x03),
      });

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it("returns existing seq on dedup match", async () => {
      const docId = await insertDoc();
      const envelope = makeEnvelope(docId);

      const seq1 = await service.submit(envelope);
      const seq2 = await service.submit(envelope);

      expect(seq1).toBe(1);
      expect(seq2).toBe(1);
    });

    it("throws for missing document", async () => {
      await expect(service.submit(makeEnvelope("nonexistent-doc"))).rejects.toThrow(
        "Document not found",
      );
    });
  });

  describe("getEnvelopesSince", () => {
    it("returns changes after sinceSeq", async () => {
      const docId = await insertDoc();
      await service.submit(makeEnvelope(docId));
      await service.submit({
        ...makeEnvelope(docId),
        nonce: nonce(0x03),
      });
      await service.submit({
        ...makeEnvelope(docId),
        nonce: nonce(0x04),
      });

      const result = await service.getEnvelopesSince(docId, 1);

      expect(result).toHaveLength(2);
      expect(result[0]?.seq).toBe(2);
      expect(result[1]?.seq).toBe(3);
    });

    it("returns empty for no matches", async () => {
      const docId = await insertDoc();
      const result = await service.getEnvelopesSince(docId, 0);
      expect(result).toEqual([]);
    });
  });

  describe("submitSnapshot", () => {
    it("upserts and updates version", async () => {
      const docId = await insertDoc();

      await service.submitSnapshot(makeSnapshotEnvelope(docId, 1));
      const snap1 = await service.getLatestSnapshot(docId);
      expect(snap1?.snapshotVersion).toBe(1);

      await service.submitSnapshot(makeSnapshotEnvelope(docId, 2));
      const snap2 = await service.getLatestSnapshot(docId);
      expect(snap2?.snapshotVersion).toBe(2);
    });

    it("preserves createdAt on update", async () => {
      const docId = await insertDoc();

      await service.submitSnapshot(makeSnapshotEnvelope(docId, 1));

      // Read createdAt from the raw row
      const [row1] = await db.select({ createdAt: syncSnapshots.createdAt }).from(syncSnapshots);
      const originalCreatedAt = row1?.createdAt;

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.submitSnapshot(makeSnapshotEnvelope(docId, 2));

      const [row2] = await db.select({ createdAt: syncSnapshots.createdAt }).from(syncSnapshots);
      expect(row2?.createdAt).toBe(originalCreatedAt);
    });

    it("throws SnapshotVersionConflictError on stale version", async () => {
      const docId = await insertDoc();

      await service.submitSnapshot(makeSnapshotEnvelope(docId, 2));

      await expect(service.submitSnapshot(makeSnapshotEnvelope(docId, 1))).rejects.toThrow(
        SnapshotVersionConflictError,
      );
    });
  });

  describe("getLatestSnapshot", () => {
    it("returns null when absent", async () => {
      const docId = await insertDoc();
      const result = await service.getLatestSnapshot(docId);
      expect(result).toBeNull();
    });

    it("returns snapshot when present", async () => {
      const docId = await insertDoc();
      await service.submitSnapshot(makeSnapshotEnvelope(docId, 3));

      const result = await service.getLatestSnapshot(docId);

      expect(result).not.toBeNull();
      expect(result?.snapshotVersion).toBe(3);
      expect(result?.documentId).toBe(docId);
    });
  });

  describe("getManifest", () => {
    it("returns docs for systemId", async () => {
      const docId = await insertDoc();

      const manifest = await service.getManifest(systemId as SystemId);

      expect(manifest.systemId).toBe(systemId);
      expect(manifest.documents).toHaveLength(1);
      expect(manifest.documents[0]?.docId).toBe(docId);
    });

    it("returns empty for unknown system", async () => {
      const manifest = await service.getManifest("sys_unknown" as SystemId);

      expect(manifest.systemId).toBe("sys_unknown");
      expect(manifest.documents).toEqual([]);
    });
  });
});
