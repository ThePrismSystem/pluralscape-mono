import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "../schema/sqlite/communication.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertChannel,
  sqliteInsertMember,
  sqliteInsertPoll,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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

describe("SQLite communication schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);
  const insertChannel = (
    systemId: string,
    opts?: Parameters<typeof sqliteInsertChannel>[2],
  ): string => sqliteInsertChannel(db, systemId, opts);
  const insertPoll = (systemId: string, opts?: Parameters<typeof sqliteInsertPoll>[2]): string =>
    sqliteInsertPoll(db, systemId, opts);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteCommunicationTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(acknowledgements).run();
    db.delete(pollVotes).run();
    db.delete(polls).run();
    db.delete(boardMessages).run();
    db.delete(notes).run();
    db.delete(messages).run();
    db.delete(channels).run();
  });

  describe("channels", () => {
    it("round-trips with encrypted_data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(channels)
        .values({
          id,
          systemId,
          type: "channel",
          sortOrder: 0,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(channels).where(eq(channels.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.type).toBe("channel");
    });

    it("rejects invalid type via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(channels)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "invalid" as "channel",
            sortOrder: 0,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects negative sort_order via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(channels)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "channel",
            sortOrder: -1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("self-ref FK sets parentId to null on parent delete", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const parentId = insertChannel(systemId, { type: "category" });
      const childId = insertChannel(systemId, { parentId });

      db.delete(channels).where(eq(channels.id, parentId)).run();
      const rows = db.select().from(channels).where(eq(channels.id, childId)).all();
      expect(rows[0]?.parentId).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);

      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'channel', 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'channel', 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = Date.now();

      db.update(channels)
        .set({ archived: true, archivedAt: now })
        .where(eq(channels.id, channelId))
        .run();

      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("messages", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on channel deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const msgId = crypto.randomUUID();
      const now = Date.now();

      db.insert(messages)
        .values({
          id: msgId,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(channels).where(eq(channels.id, channelId)).run();
      const rows = db.select().from(messages).where(eq(messages.id, msgId)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const msgId = crypto.randomUUID();
      const now = Date.now();

      db.insert(messages)
        .values({
          id: msgId,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(messages).where(eq(messages.id, msgId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), channelId, systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), channelId, systemId, now, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(messages).set({ archived: true, archivedAt: now }).where(eq(messages.id, id)).run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows replyToId referencing nonexistent message (no self-FK)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          replyToId: "nonexistent-message-id",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.replyToId).toBe("nonexistent-message-id");
    });
  });

  describe("board_messages", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 5,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.pinned).toBe(false);
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips pinned=true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          pinned: true,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.pinned).toBe(true);
    });

    it("rejects negative sort_order via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(boardMessages)
          .values({
            id: crypto.randomUUID(),
            systemId,
            sortOrder: -1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(boardMessages)
        .set({ archived: true, archivedAt: now })
        .where(eq(boardMessages.id, id))
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("notes", () => {
    it("round-trips system-wide note (null author)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.authorEntityType).toBeNull();
      expect(rows[0]?.authorEntityId).toBeNull();
    });

    it("round-trips member-bound note", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          authorEntityType: "member",
          authorEntityId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.authorEntityType).toBe("member");
      expect(rows[0]?.authorEntityId).toBe(memberId);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.authorEntityType).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO notes (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO notes (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(notes).set({ archived: true, archivedAt: now }).where(eq(notes.id, id)).run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("polls", () => {
    it("round-trips with status and closedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(polls)
        .values({
          id,
          systemId,
          status: "open",
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("open");
      expect(rows[0]?.closedAt).toBeNull();
    });

    it("defaults status to 'open'", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);

      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows[0]?.status).toBe("open");
    });

    it("rejects invalid status via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(polls)
          .values({
            id: crypto.randomUUID(),
            systemId,
            status: "invalid" as "open",
            kind: "standard",
            allowMultipleVotes: false,
            maxVotesPerMember: 1,
            allowAbstain: false,
            allowVeto: false,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(polls)
        .values({
          id,
          systemId,
          createdByMemberId: memberId,
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBe(memberId);
      expect(rows[0]?.kind).toBe("standard");
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);

      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
      expect(rows[0]?.kind).toBe("standard");
    });

    it("rejects invalid kind via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(polls)
          .values({
            id: crypto.randomUUID(),
            systemId,
            kind: "invalid" as "standard",
            allowMultipleVotes: false,
            maxVotesPerMember: 1,
            allowAbstain: false,
            allowVeto: false,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("sets createdByMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(polls)
        .values({
          id,
          systemId,
          createdByMemberId: memberId,
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("rejects nonexistent createdByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(polls)
          .values({
            id: crypto.randomUUID(),
            systemId,
            createdByMemberId: "nonexistent",
            kind: "standard",
            allowMultipleVotes: false,
            maxVotesPerMember: 1,
            allowAbstain: false,
            allowVeto: false,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);

      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(polls)
        .values({
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
        })
        .run();

      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO polls (id, system_id, kind, allow_multiple_votes, max_votes_per_member, allow_abstain, allow_veto, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'standard', 0, 1, 0, 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO polls (id, system_id, kind, allow_multiple_votes, max_votes_per_member, allow_abstain, allow_veto, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'standard', 0, 1, 0, 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const now = Date.now();

      db.update(polls).set({ archived: true, archivedAt: now }).where(eq(polls.id, pollId)).run();

      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("poll_votes", () => {
    it("round-trips with encryptedData", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20]));

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.createdAt).toBe(now);
    });

    it("rejects null encryptedData", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, voted_at, created_at, updated_at)
             VALUES (?, ?, ?, NULL, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), pollId, systemId, now, now, now),
      ).toThrow();
    });

    it("cascades on poll deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const voteId = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id: voteId,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(polls).where(eq(polls.id, pollId)).run();
      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, voteId)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const voteId = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id: voteId,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, voteId)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const votedAt = Date.now();

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          optionId: "opt-1",
          voter: { entityType: "member", entityId: "m-1" },
          isVeto: true,
          votedAt,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.optionId).toBe("opt-1");
      expect(rows[0]?.voter).toEqual({ entityType: "member", entityId: "m-1" });
      expect(rows[0]?.isVeto).toBe(true);
      expect(rows[0]?.votedAt).toBe(votedAt);
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.optionId).toBeNull();
      expect(rows[0]?.voter).toBeNull();
      expect(rows[0]?.isVeto).toBe(false);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          votedAt: now,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, voted_at, created_at, updated_at, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), pollId, systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, voted_at, created_at, updated_at, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), pollId, systemId, now, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          votedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(pollVotes)
        .set({ archived: true, archivedAt: now })
        .where(eq(pollVotes.id, id))
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("acknowledgements", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
    });

    it("round-trips confirmed state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          confirmed: true,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.confirmed).toBe(true);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips createdByMemberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          createdByMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBe(memberId);
    });

    it("defaults createdByMemberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("sets createdByMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          createdByMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("rejects nonexistent createdByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(acknowledgements)
          .values({
            id: crypto.randomUUID(),
            systemId,
            createdByMemberId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(acknowledgements)
        .set({ archived: true, archivedAt: now })
        .where(eq(acknowledgements.id, id))
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
