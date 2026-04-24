import { PGlite } from "@electric-sql/pglite";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "../schema/pg/communication.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertChannel,
  pgInsertMember,
  pgInsertPoll,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type {
  AcknowledgementId,
  BoardMessageId,
  ChannelId,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  PollVoteId,
  PollOptionId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  channels,
  messages,
  boardMessages,
  notes,
  polls,
  pollVotes,
  acknowledgements,
};

describe("PG communication schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);
  const insertChannel = (systemId: string, opts?: Parameters<typeof pgInsertChannel>[2]) =>
    pgInsertChannel(db, systemId, opts);
  const insertPoll = (systemId: string, opts?: Parameters<typeof pgInsertPoll>[2]) =>
    pgInsertPoll(db, systemId, opts);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(acknowledgements);
    await db.delete(pollVotes);
    await db.delete(polls);
    await db.delete(boardMessages);
    await db.delete(notes);
    await db.delete(messages);
    await db.delete(channels);
  });

  describe("channels", () => {
    it("round-trips with encrypted_data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const id = brandId<ChannelId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(channels).values({
        id,
        systemId,
        type: "channel",
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(channels).where(eq(channels.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.type).toBe("channel");
      expect(rows[0]?.sortOrder).toBe(0);
    });

    it("rejects invalid type via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(channels).values({
          id: brandId<ChannelId>(crypto.randomUUID()),
          systemId,
          type: "invalid" as "channel",
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative sort_order via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(channels).values({
          id: brandId<ChannelId>(crypto.randomUUID()),
          systemId,
          type: "channel",
          sortOrder: -1,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts parent channel deletion when referenced by child channel", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const parentId = await insertChannel(systemId, { type: "category" });
      await insertChannel(systemId, { parentId });

      await expect(db.delete(channels).where(eq(channels.id, parentId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ChannelId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(channels).values({
        id,
        systemId,
        type: "channel",
        sortOrder: 0,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(channels).where(eq(channels.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      const archiveTime = fixtureNow();
      await db
        .update(channels)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(channels.id, channelId));

      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'channel', 0, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
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
          "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'channel', 0, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("messages", () => {
    it("round-trips with all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.editedAt).toBeNull();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(messages)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(messages.id, id));

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("round-trips editedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();
      const editedAt = toUnixMillis(now + 1000);

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        editedAt,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.editedAt).toBe(editedAt);
    });

    it("restricts channel deletion when referenced by message", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const msgId = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(channels).where(eq(channels.id, channelId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const msgId = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(messages).where(eq(messages.id, msgId));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, true, NULL)",
          [crypto.randomUUID(), channelId, systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, false, $7)",
          [crypto.randomUUID(), channelId, systemId, now, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("allows replyToId referencing nonexistent message (no self-FK)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        replyToId: brandId<MessageId>("nonexistent-message-id"),
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.replyToId).toBe("nonexistent-message-id");
    });

    it("rejects duplicate (id, timestamp) pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(messages).values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same id with different timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: toUnixMillis(now + 1000),
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(2);
    });
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

  describe("polls", () => {
    it("round-trips with status and closedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(polls).values({
        id,
        systemId,
        kind: "standard",
        status: "open",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(polls).where(eq(polls.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("open");
      expect(rows[0]?.closedAt).toBeNull();
    });

    it("defaults status to 'open'", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows[0]?.status).toBe("open");
    });

    it("rejects invalid status via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(polls).values({
          id: brandId<PollId>(crypto.randomUUID()),
          systemId,
          kind: "standard",
          status: "invalid" as "open",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(polls).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(polls).where(eq(polls.id, id));
      expect(rows[0]?.createdByMemberId).toBe(memberId);
      expect(rows[0]?.kind).toBe("standard");
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows[0]?.createdByMemberId).toBeNull();
      expect(rows[0]?.kind).toBe("standard");
    });

    it("rejects invalid kind via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(polls).values({
          id: brandId<PollId>(crypto.randomUUID()),
          systemId,
          kind: "invalid" as "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("restricts member deletion when referenced by poll", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(polls).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent createdByMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(polls).values({
          id: brandId<PollId>(crypto.randomUUID()),
          systemId,
          createdByMemberId: brandId<MemberId>("nonexistent"),
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(polls).values({
        id,
        systemId,
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(polls).where(eq(polls.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      const archiveTime = fixtureNow();
      await db
        .update(polls)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(polls.id, pollId));

      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO polls (id, system_id, kind, allow_multiple_votes, max_votes_per_member, allow_abstain, allow_veto, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'standard', false, 1, false, false, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
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
          "INSERT INTO polls (id, system_id, kind, allow_multiple_votes, max_votes_per_member, allow_abstain, allow_veto, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'standard', false, 1, false, false, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("poll_votes", () => {
    it("round-trips with encryptedData", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20]));

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.createdAt).toBe(now);
    });

    it("rejects null encryptedData", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const now = new Date().toISOString();

      await expect(
        client.query(
          `INSERT INTO poll_votes (id, poll_id, system_id, voter, encrypted_data, voted_at, created_at, updated_at)
           VALUES ($1, $2, $3, '{"entityType":"member","entityId":"m-1"}'::jsonb, NULL, $4, $5, $5)`,
          [crypto.randomUUID(), pollId, systemId, now, now],
        ),
      ).rejects.toThrow();
    });

    it("restricts poll deletion when referenced by vote", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const voteId = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id: voteId,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(polls).where(eq(polls.id, pollId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const voteId = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id: voteId,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, voteId));
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();
      const votedAt = fixtureNow();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        optionId: brandId<PollOptionId>("opt-1"),
        voter: { entityType: "member", entityId: brandId<MemberId>("m-1") },
        isVeto: true,
        votedAt,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.optionId).toBe("opt-1");
      expect(rows[0]?.voter).toEqual({ entityType: "member", entityId: "m-1" });
      expect(rows[0]?.isVeto).toBe(true);
      expect(rows[0]?.votedAt).toBe(votedAt);
    });

    it("defaults optional T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.optionId).toBeNull();
      expect(rows[0]?.isVeto).toBe(false);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { entityType: "member", entityId: brandId<MemberId>("m-test") },
        votedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(pollVotes)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(pollVotes.id, id));

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, voted_at, created_at, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, true, NULL)",
          [crypto.randomUUID(), pollId, systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, voted_at, created_at, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, false, $6)",
          [crypto.randomUUID(), pollId, systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("acknowledgements", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
    });

    it("round-trips confirmed state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        confirmed: true,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.confirmed).toBe(true);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(0);
    });

    it("round-trips createdByMemberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.createdByMemberId).toBe(memberId);
    });

    it("defaults createdByMemberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("restricts member deletion when referenced by acknowledgement", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent createdByMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(acknowledgements).values({
          id: brandId<AcknowledgementId>(crypto.randomUUID()),
          systemId,
          createdByMemberId: brandId<MemberId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(acknowledgements)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(acknowledgements.id, id));

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $3, true, NULL)",
          [crypto.randomUUID(), systemId, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $3, false, $4)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
