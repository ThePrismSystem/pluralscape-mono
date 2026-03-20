/**
 * PgSyncRelayService integration tests.
 *
 * Uses PGlite for a real Postgres environment with the document-level sync schema.
 */
import { PGlite } from "@electric-sql/pglite";
import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PgSyncRelayService } from "../../services/sync-relay.service.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const schema = { syncDocuments, syncChanges, syncSnapshots };

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

/**
 * Raw DDL for minimal schema setup in PGlite.
 * Avoids importing test helpers from packages/db.
 */
const SETUP_DDL = `
  CREATE TABLE accounts (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE systems (
    id VARCHAR(50) PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE sync_documents (
    document_id VARCHAR(255) PRIMARY KEY,
    system_id VARCHAR(50) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    snapshot_version INTEGER NOT NULL DEFAULT 0,
    last_seq INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    time_period VARCHAR(50),
    key_type VARCHAR(50) NOT NULL DEFAULT 'derived',
    bucket_id VARCHAR(50),
    channel_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (size_bytes >= 0),
    CHECK (snapshot_version >= 0),
    CHECK (last_seq >= 0)
  );
  CREATE INDEX sync_documents_system_id_idx ON sync_documents(system_id);

  CREATE TABLE sync_changes (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL REFERENCES sync_documents(document_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    author_public_key BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE UNIQUE INDEX sync_changes_document_id_seq_idx ON sync_changes(document_id, seq);
  CREATE UNIQUE INDEX sync_changes_dedup_idx ON sync_changes(document_id, author_public_key, nonce);

  CREATE TABLE sync_snapshots (
    document_id VARCHAR(255) PRIMARY KEY REFERENCES sync_documents(document_id) ON DELETE CASCADE,
    snapshot_version INTEGER NOT NULL,
    encrypted_payload BYTEA NOT NULL,
    author_public_key BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );
`;

describe("PgSyncRelayService", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let service: PgSyncRelayService;
  let systemId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    // PgliteDatabase and PostgresJsDatabase share the same query interface
    const pgDb: unknown = db;
    service = new PgSyncRelayService(pgDb as PostgresJsDatabase);
    await client.exec(SETUP_DDL);

    // Seed account + system
    const accountId = crypto.randomUUID();
    systemId = `sys_${crypto.randomUUID().slice(0, 8)}`;
    await client.exec(`INSERT INTO accounts (id) VALUES ('${accountId}')`);
    await client.exec(
      `INSERT INTO systems (id, account_id) VALUES ('${systemId}', '${accountId}')`,
    );
  });

  afterAll(async () => {
    await client.close();
  });

  /** Insert a sync_documents row and return the documentId. */
  async function insertDoc(
    overrides: { docType?: string; bucketId?: string } = {},
  ): Promise<string> {
    const docId = `system-core-sys_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const docType = overrides.docType ?? "system-core";
    const bucketId = overrides.bucketId ?? null;
    await client.exec(
      `INSERT INTO sync_documents (document_id, system_id, doc_type, bucket_id, created_at, updated_at)
       VALUES ('${docId}', '${systemId}', '${docType}', ${bucketId ? `'${bucketId}'` : "NULL"}, '${now}', '${now}')`,
    );
    return docId;
  }

  afterEach(async () => {
    await client.exec("DELETE FROM sync_snapshots");
    await client.exec("DELETE FROM sync_changes");
    await client.exec("DELETE FROM sync_documents");
  });

  describe("submit", () => {
    it("assigns an incrementing seq number", async () => {
      const docId = await insertDoc();
      const seq1 = await service.submit(mockChange(docId));
      const seq2 = await service.submit({
        ...mockChange(docId),
        nonce: nonce(0x11),
      });
      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
    });

    it("throws for unknown document", async () => {
      await expect(service.submit(mockChange("nonexistent-doc"))).rejects.toThrow(
        "Document not found",
      );
    });

    it("deduplicates by (documentId, authorPublicKey, nonce)", async () => {
      const docId = await insertDoc();
      const change = mockChange(docId);

      const seq1 = await service.submit(change);
      const seq2 = await service.submit(change); // same authorPublicKey + nonce

      expect(seq1).toBe(seq2); // returns existing seq
    });

    it("stores and returns the signature", async () => {
      const docId = await insertDoc();
      const change = mockChange(docId);

      await service.submit(change);
      const envelopes = await service.getEnvelopesSince(docId, 0);

      expect(envelopes).toHaveLength(1);
      expect(envelopes[0]?.signature).toEqual(change.signature);
    });
  });

  describe("submitSnapshot", () => {
    it("accepts a higher snapshot version", async () => {
      const docId = await insertDoc();
      await expect(service.submitSnapshot(mockSnapshot(docId, 1))).resolves.not.toThrow();
    });

    it("rejects same or lower version atomically", async () => {
      const docId = await insertDoc();
      await service.submitSnapshot(mockSnapshot(docId, 5));

      await expect(service.submitSnapshot(mockSnapshot(docId, 5))).rejects.toThrow(
        "is not newer than current version",
      );
      await expect(service.submitSnapshot(mockSnapshot(docId, 3))).rejects.toThrow(
        "is not newer than current version",
      );
    });

    it("throws for unknown document", async () => {
      await expect(service.submitSnapshot(mockSnapshot("nonexistent-doc", 1))).rejects.toThrow(
        "Document not found",
      );
    });

    it("stores and returns the signature", async () => {
      const docId = await insertDoc();
      await service.submitSnapshot(mockSnapshot(docId, 1));

      const snapshot = await service.getLatestSnapshot(docId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.signature).toEqual(sig(0xee));
    });
  });

  describe("getEnvelopesSince", () => {
    it("returns changes in ascending seq order", async () => {
      const docId = await insertDoc();
      await service.submit(mockChange(docId));
      await service.submit({ ...mockChange(docId), nonce: nonce(0x11) });
      await service.submit({ ...mockChange(docId), nonce: nonce(0x22) });

      const envelopes = await service.getEnvelopesSince(docId, 0);
      expect(envelopes).toHaveLength(3);
      expect(envelopes[0]?.seq).toBe(1);
      expect(envelopes[1]?.seq).toBe(2);
      expect(envelopes[2]?.seq).toBe(3);
    });

    it("excludes changes at or below sinceSeq", async () => {
      const docId = await insertDoc();
      await service.submit(mockChange(docId));
      await service.submit({ ...mockChange(docId), nonce: nonce(0x11) });

      const envelopes = await service.getEnvelopesSince(docId, 1);
      expect(envelopes).toHaveLength(1);
      expect(envelopes[0]?.seq).toBe(2);
    });

    it("returns real signatures", async () => {
      const docId = await insertDoc();
      const change = mockChange(docId);
      await service.submit(change);

      const envelopes = await service.getEnvelopesSince(docId, 0);
      expect(envelopes[0]?.signature).toEqual(change.signature);
      expect(envelopes[0]?.signature).not.toEqual(new Uint8Array(0));
    });
  });

  describe("getLatestSnapshot", () => {
    it("returns null when no snapshot exists", async () => {
      const docId = await insertDoc();
      const snapshot = await service.getLatestSnapshot(docId);
      expect(snapshot).toBeNull();
    });

    it("returns real signature", async () => {
      const docId = await insertDoc();
      const snap = mockSnapshot(docId, 1);
      await service.submitSnapshot(snap);

      const snapshot = await service.getLatestSnapshot(docId);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.signature).toEqual(snap.signature);
    });
  });

  describe("getManifest", () => {
    it("returns documents for the given system", async () => {
      await insertDoc();
      await insertDoc({ docType: "fronting" });

      const manifest = await service.getManifest(systemId as SystemId);
      expect(manifest.systemId).toBe(systemId);
      expect(manifest.documents).toHaveLength(2);
    });

    it("returns empty for unknown system", async () => {
      const manifest = await service.getManifest("sys_unknown" as SystemId);
      expect(manifest.documents).toHaveLength(0);
    });
  });
});
