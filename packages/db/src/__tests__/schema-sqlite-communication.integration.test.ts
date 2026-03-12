import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  });

  describe("notes", () => {
    it("round-trips with nullable memberId", () => {
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
      expect(rows[0]?.memberId).toBeNull();
    });

    it("sets memberId to null on member deletion (SET NULL)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notes)
        .values({
          id,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });

    it("defaults archived to false", () => {
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
      expect(rows[0]?.memberId).toBeNull();
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
          encryptedData: data,
          createdAt: now,
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
            `INSERT INTO poll_votes (id, poll_id, system_id, encrypted_data, created_at)
             VALUES (?, ?, ?, NULL, ?)`,
          )
          .run(crypto.randomUUID(), pollId, systemId, now),
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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows[0]?.optionId).toBeNull();
      expect(rows[0]?.voter).toBeNull();
      expect(rows[0]?.isVeto).toBe(false);
      expect(rows[0]?.votedAt).toBeNull();
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
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
