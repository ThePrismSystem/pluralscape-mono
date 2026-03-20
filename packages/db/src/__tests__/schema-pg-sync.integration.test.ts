import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { syncChanges, syncDocuments, syncSnapshots } from "../schema/pg/sync.js";
import { systems } from "../schema/pg/systems.js";

import { createPgSyncTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { NewSyncDocument } from "../schema/pg/sync.js";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, syncDocuments, syncChanges, syncSnapshots };

describe("PG sync schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSyncTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(syncSnapshots);
    await db.delete(syncChanges);
    await db.delete(syncDocuments);
  });

  /** Build a minimal valid syncDocuments insert payload. */
  function makeDoc(systemId: string, overrides: Partial<NewSyncDocument> = {}): NewSyncDocument {
    return {
      documentId: crypto.randomUUID(),
      systemId,
      docType: "system-core",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  /** Build a minimal valid syncChanges insert payload. */
  function makeChange(documentId: string, seq: number) {
    return {
      id: crypto.randomUUID(),
      documentId,
      seq,
      encryptedPayload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      authorPublicKey: new Uint8Array(32).fill(0x01),
      nonce: new Uint8Array(24).fill(seq),
      signature: new Uint8Array(64).fill(0x03),
      createdAt: Date.now(),
    };
  }

  /** Build a minimal valid syncSnapshots insert payload. */
  function makeSnapshot(documentId: string) {
    return {
      documentId,
      snapshotVersion: 1,
      encryptedPayload: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]),
      authorPublicKey: new Uint8Array(32).fill(0x02),
      nonce: new Uint8Array(24).fill(0xaa),
      signature: new Uint8Array(64).fill(0x04),
      createdAt: Date.now(),
    };
  }

  describe("sync_documents", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        documentId,
        systemId,
        docType: "fronting",
        sizeBytes: 512,
        snapshotVersion: 3,
        lastSeq: 7,
        archived: true,
        timePeriod: "2024-01",
        keyType: "bucket",
        bucketId: crypto.randomUUID(),
        channelId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId));
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.systemId).toBe(systemId);
      expect(row?.docType).toBe("fronting");
      expect(row?.sizeBytes).toBe(512);
      expect(row?.snapshotVersion).toBe(3);
      expect(row?.lastSeq).toBe(7);
      expect(row?.archived).toBe(true);
      expect(row?.timePeriod).toBe("2024-01");
      expect(row?.keyType).toBe("bucket");
      expect(row?.createdAt).toBe(now);
      expect(row?.updatedAt).toBe(now);
    });

    it("defaults sizeBytes=0, snapshotVersion=0, lastSeq=0, archived=false, keyType='derived'", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        documentId,
        systemId,
        docType: "system-core",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId));
      const row = rows[0];
      expect(row?.sizeBytes).toBe(0);
      expect(row?.snapshotVersion).toBe(0);
      expect(row?.lastSeq).toBe(0);
      expect(row?.archived).toBe(false);
      expect(row?.keyType).toBe("derived");
    });

    it("allows nullable timePeriod, bucketId, channelId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        documentId,
        systemId,
        docType: "journal",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId));
      const row = rows[0];
      expect(row?.timePeriod).toBeNull();
      expect(row?.bucketId).toBeNull();
      expect(row?.channelId).toBeNull();
    });

    it.each(["system-core", "fronting", "chat", "journal", "privacy-config", "bucket"] as const)(
      "accepts valid doc_type '%s'",
      async (docType) => {
        const accountId = await insertAccount();
        const systemId = await insertSystem(accountId);
        const now = Date.now();

        await expect(
          db.insert(syncDocuments).values({
            documentId: crypto.randomUUID(),
            systemId,
            docType,
            createdAt: now,
            updatedAt: now,
          }),
        ).resolves.not.toThrow();
      },
    );

    it("rejects invalid doc_type", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          documentId: crypto.randomUUID(),
          systemId,
          docType: "invalid-type" as "system-core",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid key_type", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          documentId: crypto.randomUUID(),
          systemId,
          docType: "system-core",
          keyType: "invalid-key" as "derived",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects sizeBytes < 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          documentId: crypto.randomUUID(),
          systemId,
          docType: "system-core",
          sizeBytes: -1,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects snapshotVersion < 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          documentId: crypto.randomUUID(),
          systemId,
          docType: "system-core",
          snapshotVersion: -1,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects lastSeq < 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          documentId: crypto.randomUUID(),
          systemId,
          docType: "system-core",
          lastSeq: -1,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const documentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        documentId,
        systemId,
        docType: "system-core",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));

      const rows = await db
        .select()
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, documentId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("sync_changes", () => {
    it("round-trips all fields including binary columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      const encryptedPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
      const authorPublicKey = new Uint8Array(32).fill(0x03);
      const nonce = new Uint8Array(24).fill(0x04);
      const changeId = crypto.randomUUID();

      await db.insert(syncChanges).values({
        id: changeId,
        documentId,
        seq: 1,
        encryptedPayload,
        authorPublicKey,
        nonce,
        createdAt: now,
      });

      const rows = await db.select().from(syncChanges).where(eq(syncChanges.id, changeId));
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.documentId).toBe(documentId);
      expect(row?.seq).toBe(1);
      expect(row?.encryptedPayload).toEqual(encryptedPayload);
      expect(row?.authorPublicKey).toEqual(authorPublicKey);
      expect(row?.nonce).toEqual(nonce);
      expect(row?.createdAt).toBe(now);
    });

    it("round-trips binary content byte-for-byte", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      const encryptedPayload = new Uint8Array([0xff, 0x00, 0xab, 0xcd, 0xef]);

      await db.insert(syncChanges).values({
        ...makeChange(documentId, 1),
        encryptedPayload,
      });

      const rows = await db
        .select()
        .from(syncChanges)
        .where(eq(syncChanges.documentId, documentId));
      expect(rows[0]?.encryptedPayload).toBeInstanceOf(Uint8Array);
      expect(rows[0]?.encryptedPayload).toEqual(encryptedPayload);
    });

    it("enforces unique (documentId, seq) constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      await db.insert(syncChanges).values(makeChange(documentId, 1));

      const duplicate = { ...makeChange(documentId, 1), id: crypto.randomUUID() };
      await expect(db.insert(syncChanges).values(duplicate)).rejects.toThrow();
    });

    it("allows same seq on different documents", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc1] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const [doc2] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const docId1 = doc1?.documentId ?? "";
      const docId2 = doc2?.documentId ?? "";

      await db.insert(syncChanges).values(makeChange(docId1, 1));
      await expect(db.insert(syncChanges).values(makeChange(docId2, 1))).resolves.not.toThrow();
    });

    it("enforces dedup unique (documentId, authorPublicKey, nonce) constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      const authorPublicKey = new Uint8Array(32).fill(0x05);
      const nonce = new Uint8Array(24).fill(0x06);

      await db.insert(syncChanges).values({
        id: crypto.randomUUID(),
        documentId,
        seq: 1,
        encryptedPayload: new Uint8Array([0x01]),
        authorPublicKey,
        nonce,
        createdAt: Date.now(),
      });

      await expect(
        db.insert(syncChanges).values({
          id: crypto.randomUUID(),
          documentId,
          seq: 2,
          encryptedPayload: new Uint8Array([0x02]),
          authorPublicKey,
          nonce,
          createdAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on document deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      const change = makeChange(documentId, 1);
      await db.insert(syncChanges).values(change);

      await db.delete(syncDocuments).where(eq(syncDocuments.documentId, documentId));

      const rows = await db.select().from(syncChanges).where(eq(syncChanges.id, change.id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("sync_snapshots", () => {
    it("round-trips all fields including binary columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      const encryptedPayload = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      const authorPublicKey = new Uint8Array(32).fill(0x07);
      const nonce = new Uint8Array(24).fill(0x08);

      await db.insert(syncSnapshots).values({
        documentId,
        snapshotVersion: 5,
        encryptedPayload,
        authorPublicKey,
        nonce,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId));
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.snapshotVersion).toBe(5);
      expect(row?.encryptedPayload).toEqual(encryptedPayload);
      expect(row?.authorPublicKey).toEqual(authorPublicKey);
      expect(row?.nonce).toEqual(nonce);
      expect(row?.createdAt).toBe(now);
    });

    it("enforces one snapshot per document (upsert replaces)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      await db.insert(syncSnapshots).values(makeSnapshot(documentId));

      // A second insert with the same documentId (PK) must fail as a plain insert.
      await expect(
        db.insert(syncSnapshots).values({ ...makeSnapshot(documentId), snapshotVersion: 2 }),
      ).rejects.toThrow();
    });

    it("upsert (onConflictDoUpdate) replaces the existing snapshot", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      await db.insert(syncSnapshots).values(makeSnapshot(documentId));

      const newPayload = new Uint8Array([0x11, 0x22, 0x33]);
      const newNonce = new Uint8Array(24).fill(0xbb);
      const updatedAt = Date.now();

      await db
        .insert(syncSnapshots)
        .values({
          documentId,
          snapshotVersion: 2,
          encryptedPayload: newPayload,
          authorPublicKey: new Uint8Array(32).fill(0x09),
          nonce: newNonce,
          createdAt: updatedAt,
        })
        .onConflictDoUpdate({
          target: syncSnapshots.documentId,
          set: {
            snapshotVersion: 2,
            encryptedPayload: newPayload,
            nonce: newNonce,
            createdAt: updatedAt,
          },
        });

      const rows = await db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.snapshotVersion).toBe(2);
      expect(rows[0]?.encryptedPayload).toEqual(newPayload);
    });

    it("cascades on document deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      const [doc] = await db.insert(syncDocuments).values(makeDoc(systemId)).returning();
      const documentId = doc?.documentId ?? "";

      await db.insert(syncSnapshots).values(makeSnapshot(documentId));

      await db.delete(syncDocuments).where(eq(syncDocuments.documentId, documentId));

      const rows = await db
        .select()
        .from(syncSnapshots)
        .where(eq(syncSnapshots.documentId, documentId));
      expect(rows).toHaveLength(0);
    });
  });
});
