import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { syncChanges, syncDocuments, syncSnapshots } from "../schema/sqlite/sync.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSyncTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { SyncDocumentType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, syncDocuments, syncChanges, syncSnapshots };

describe("SQLite sync schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  /** Insert a minimal valid syncDocuments row and return its documentId. */
  const insertDocument = (systemId: string, docType: SyncDocumentType = "system-core"): string => {
    const documentId = crypto.randomUUID();
    const now = Date.now();
    db.insert(syncDocuments)
      .values({ documentId, systemId, docType, createdAt: now, updatedAt: now })
      .run();
    return documentId;
  };

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSyncTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(syncSnapshots).run();
    db.delete(syncChanges).run();
    db.delete(syncDocuments).run();
  });

  // ---------------------------------------------------------------------------
  // sync_documents
  // ---------------------------------------------------------------------------

  describe("sync_documents", () => {
    it("round-trips all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({
          documentId,
          systemId,
          docType: "fronting",
          sizeBytes: 1024,
          snapshotVersion: 2,
          lastSeq: 7,
          archived: true,
          timePeriod: "2024-01",
          keyType: "bucket",
          bucketId: crypto.randomUUID(),
          channelId: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now + 1000,
        })
        .run();

      const rows = db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId))
        .all();

      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.systemId).toBe(systemId);
      expect(row?.docType).toBe("fronting");
      expect(row?.sizeBytes).toBe(1024);
      expect(row?.snapshotVersion).toBe(2);
      expect(row?.lastSeq).toBe(7);
      expect(row?.archived).toBe(true);
      expect(row?.timePeriod).toBe("2024-01");
      expect(row?.keyType).toBe("bucket");
      expect(row?.bucketId).toBeDefined();
      expect(row?.channelId).toBeDefined();
      expect(row?.createdAt).toBe(now);
      expect(row?.updatedAt).toBe(now + 1000);
    });

    it("applies default values: sizeBytes=0, snapshotVersion=0, lastSeq=0, archived=false, keyType='derived'", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({ documentId, systemId, docType: "chat", createdAt: now, updatedAt: now })
        .run();

      const rows = db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId))
        .all();

      expect(rows[0]?.sizeBytes).toBe(0);
      expect(rows[0]?.snapshotVersion).toBe(0);
      expect(rows[0]?.lastSeq).toBe(0);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.keyType).toBe("derived");
    });

    it("allows null for optional fields: timePeriod, bucketId, channelId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({ documentId, systemId, docType: "journal", createdAt: now, updatedAt: now })
        .run();

      const rows = db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId))
        .all();

      expect(rows[0]?.timePeriod).toBeNull();
      expect(rows[0]?.bucketId).toBeNull();
      expect(rows[0]?.channelId).toBeNull();
    });

    it("rejects invalid doc_type", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            documentId: crypto.randomUUID(),
            systemId,
            docType: "invalid-type" as "chat",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects invalid key_type", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO sync_documents (document_id, system_id, doc_type, key_type, created_at, updated_at)
             VALUES (?, ?, 'system-core', 'invalid-key-type', ?, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow();
    });

    it("rejects negative sizeBytes", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            documentId: crypto.randomUUID(),
            systemId,
            docType: "system-core",
            sizeBytes: -1,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects negative snapshotVersion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            documentId: crypto.randomUUID(),
            systemId,
            docType: "system-core",
            snapshotVersion: -1,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects negative lastSeq", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            documentId: crypto.randomUUID(),
            systemId,
            docType: "system-core",
            lastSeq: -1,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();

      const rows = db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // sync_changes
  // ---------------------------------------------------------------------------

  describe("sync_changes", () => {
    it("round-trips all fields including binary columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const payload = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const authorKey = Buffer.from([0xaa, 0xbb, 0xcc]);
      const nonce = Buffer.from([0x11, 0x22, 0x33]);
      const signature = Buffer.alloc(64, 0x77);

      const signature = Buffer.from([0x44, 0x55, 0x66]);

      db.insert(syncChanges)
        .values({
          id,
          documentId,
          seq: 1,
          encryptedPayload: payload,
          authorPublicKey: authorKey,
          nonce,
          signature,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncChanges).where(eq(syncChanges.id, id)).all();
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.documentId).toBe(documentId);
      expect(row?.seq).toBe(1);
      expect(Buffer.from(row?.encryptedPayload as Buffer)).toEqual(payload);
      expect(Buffer.from(row?.authorPublicKey as Buffer)).toEqual(authorKey);
      expect(Buffer.from(row?.nonce as Buffer)).toEqual(nonce);
      expect(Buffer.from(row?.signature as Buffer)).toEqual(signature);
      expect(row?.createdAt).toBe(now);
    });

    it("enforces unique (documentId, seq) constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const makeChange = () =>
        Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex").subarray(0, 8);
      const makeSig = () => Buffer.alloc(64, 0x77);

      db.insert(syncChanges)
        .values({
          id: crypto.randomUUID(),
          documentId,
          seq: 5,
          encryptedPayload: makeChange(),
          authorPublicKey: makeChange(),
          nonce: makeChange(),
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(syncChanges)
          .values({
            id: crypto.randomUUID(),
            documentId,
            seq: 5,
            encryptedPayload: makeChange(),
            authorPublicKey: makeChange(),
            nonce: makeChange(),
            signature: Buffer.from([0x44, 0x55]),
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("allows same seq across different documents", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const docId1 = insertDocument(systemId, "chat");
      const docId2 = insertDocument(systemId, "journal");
      const now = Date.now();
      const makeChange = () =>
        Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex").subarray(0, 8);
      const makeSig = () => Buffer.alloc(64, 0x77);

      db.insert(syncChanges)
        .values({
          id: crypto.randomUUID(),
          documentId: docId1,
          seq: 1,
          encryptedPayload: makeChange(),
          authorPublicKey: makeChange(),
          nonce: makeChange(),
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      db.insert(syncChanges)
        .values({
          id: crypto.randomUUID(),
          documentId: docId2,
          seq: 1,
          encryptedPayload: makeChange(),
          authorPublicKey: makeChange(),
          nonce: makeChange(),
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      const rows1 = db.select().from(syncChanges).where(eq(syncChanges.documentId, docId1)).all();
      const rows2 = db.select().from(syncChanges).where(eq(syncChanges.documentId, docId2)).all();
      expect(rows1).toHaveLength(1);
      expect(rows2).toHaveLength(1);
    });

    it("deduplicates via unique (documentId, authorPublicKey, nonce) constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const authorKey = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const nonce = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

      db.insert(syncChanges)
        .values({
          id: crypto.randomUUID(),
          documentId,
          seq: 1,
          encryptedPayload: Buffer.from([0x01]),
          authorPublicKey: authorKey,
          nonce,
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(syncChanges)
          .values({
            id: crypto.randomUUID(),
            documentId,
            seq: 2,
            encryptedPayload: Buffer.from([0x02]),
            authorPublicKey: authorKey,
            nonce,
            signature: Buffer.from([0x44, 0x55]),
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on document deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const buf = Buffer.from([0x01, 0x02]);

      db.insert(syncChanges)
        .values({
          id,
          documentId,
          seq: 1,
          encryptedPayload: buf,
          authorPublicKey: buf,
          nonce: buf,
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      db.delete(syncDocuments).where(eq(syncDocuments.documentId, documentId)).run();

      const rows = db.select().from(syncChanges).where(eq(syncChanges.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // sync_snapshots
  // ---------------------------------------------------------------------------

  describe("sync_snapshots", () => {
    it("round-trips all fields including binary columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const payload = Buffer.from([0xf0, 0xe1, 0xd2, 0xc3]);
      const authorKey = Buffer.from([0x10, 0x20, 0x30]);
      const nonce = Buffer.from([0xa1, 0xb2, 0xc3]);
      const signature = Buffer.alloc(64, 0x88);

      const signature = Buffer.from([0x44, 0x55]);

      db.insert(syncSnapshots)
        .values({
          documentId,
          snapshotVersion: 3,
          encryptedPayload: payload,
          authorPublicKey: authorKey,
          nonce,
          signature,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId))
        .all();

      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.snapshotVersion).toBe(3);
      expect(Buffer.from(row?.encryptedPayload as Buffer)).toEqual(payload);
      expect(Buffer.from(row?.authorPublicKey as Buffer)).toEqual(authorKey);
      expect(Buffer.from(row?.nonce as Buffer)).toEqual(nonce);
      expect(Buffer.from(row?.signature as Buffer)).toEqual(signature);
      expect(row?.createdAt).toBe(now);
    });

    it("enforces one snapshot per document (upsert replaces previous)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const buf = Buffer.from([0x01]);
      const sig = Buffer.alloc(64, 0x88);

      db.insert(syncSnapshots)
        .values({
          documentId,
          snapshotVersion: 1,
          encryptedPayload: buf,
          authorPublicKey: buf,
          nonce: buf,
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      // Upsert: replace with a newer snapshot version
      client
        .prepare(
          `INSERT INTO sync_snapshots (document_id, snapshot_version, encrypted_payload, author_public_key, nonce, signature, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (document_id) DO UPDATE SET
             snapshot_version = excluded.snapshot_version,
             encrypted_payload = excluded.encrypted_payload,
             author_public_key = excluded.author_public_key,
             nonce = excluded.nonce,
             signature = excluded.signature,
             created_at = excluded.created_at`,
        )
        .run(documentId, 2, Buffer.from([0x02]), buf, buf, Buffer.from([0x44, 0x55]), now + 1000);

      const rows = db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId))
        .all();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.snapshotVersion).toBe(2);
    });

    it("rejects duplicate documentId insert without ON CONFLICT", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const buf = Buffer.from([0x01]);
      const sig = Buffer.alloc(64, 0x88);

      db.insert(syncSnapshots)
        .values({
          documentId,
          snapshotVersion: 1,
          encryptedPayload: buf,
          authorPublicKey: buf,
          nonce: buf,
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(syncSnapshots)
          .values({
            documentId,
            snapshotVersion: 2,
            encryptedPayload: buf,
            authorPublicKey: buf,
            nonce: buf,
            signature: Buffer.from([0x44, 0x55]),
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("rejects negative snapshotVersion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const buf = Buffer.from([0x01]);
      const sig = Buffer.alloc(64, 0x88);

      expect(() =>
        db
          .insert(syncSnapshots)
          .values({
            documentId,
            snapshotVersion: -1,
            encryptedPayload: buf,
            authorPublicKey: buf,
            nonce: buf,
            signature: sig,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on document deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const documentId = insertDocument(systemId);
      const now = Date.now();
      const buf = Buffer.from([0x01]);
      const sig = Buffer.alloc(64, 0x88);

      db.insert(syncSnapshots)
        .values({
          documentId,
          snapshotVersion: 1,
          encryptedPayload: buf,
          authorPublicKey: buf,
          nonce: buf,
          signature: Buffer.from([0x44, 0x55]),
          createdAt: now,
        })
        .run();

      db.delete(syncDocuments).where(eq(syncDocuments.documentId, documentId)).run();

      const rows = db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });
});
