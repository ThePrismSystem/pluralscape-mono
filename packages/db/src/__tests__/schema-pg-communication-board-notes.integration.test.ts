import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { boardMessages, notes } from "../schema/pg/communication.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCommunicationTables,
  insertAccount as insertAccountWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  setupCommunicationFixture,
  teardownCommunicationFixture,
  type CommunicationDb,
} from "./helpers/communication-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { BoardMessageId, MemberId, NoteId } from "@pluralscape/types";

describe("PG communication schema — board messages and notes", () => {
  let client: PGlite;
  let db: CommunicationDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => insertMemberWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupCommunicationFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownCommunicationFixture({ client, db });
  });

  afterEach(async () => {
    await clearCommunicationTables(db);
  });

  describe("board_messages", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        sortOrder: 5,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.pinned).toBe(false);
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips pinned=true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        pinned: true,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows[0]?.pinned).toBe(true);
    });

    it("rejects negative sort_order via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(boardMessages).values({
          id: brandId<BoardMessageId>(crypto.randomUUID()),
          systemId,
          sortOrder: -1,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        sortOrder: 0,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(boardMessages).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(boardMessages)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(boardMessages.id, id));

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("notes", () => {
    it("round-trips system-wide note (null author)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.authorEntityType).toBeNull();
      expect(rows[0]?.authorEntityId).toBeNull();
    });

    it("round-trips member-bound note", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        authorEntityType: "member",
        authorEntityId: brandId<MemberId>(memberId),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.authorEntityType).toBe("member");
      expect(rows[0]?.authorEntityId).toBe(memberId);
    });

    it("rejects mismatched author null pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = new Date(Date.now()).toISOString();

      await expect(
        client.query(
          "INSERT INTO notes (id, system_id, author_entity_type, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, 'member', '\\x0102'::bytea, $3, $4, 1, false)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects invalid authorEntityType", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = new Date(Date.now()).toISOString();

      await expect(
        client.query(
          "INSERT INTO notes (id, system_id, author_entity_type, author_entity_id, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, 'invalid', 'some_id', '\\x0102'::bytea, $3, $4, 1, false)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(notes)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(notes.id, id));

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO notes (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO notes (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
