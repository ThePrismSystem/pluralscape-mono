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
  sqliteInsertMember,
  sqliteInsertSystem,
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

  function insertChannel(
    systemId: string,
    opts: {
      id?: string;
      type?: "category" | "channel";
      parentId?: string;
      sortOrder?: number;
    } = {},
  ): string {
    const id = opts.id ?? crypto.randomUUID();
    const now = Date.now();
    db.insert(channels)
      .values({
        id,
        systemId,
        type: opts.type ?? "channel",
        parentId: opts.parentId ?? null,
        sortOrder: opts.sortOrder ?? 0,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertPoll(systemId: string, opts: { id?: string } = {}): string {
    const id = opts.id ?? crypto.randomUUID();
    const now = Date.now();
    db.insert(polls)
      .values({
        id,
        systemId,
        createdByMemberId: crypto.randomUUID(),
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

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
      const data = new Uint8Array([10, 20, 30]);
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
            encryptedData: new Uint8Array([1]),
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
            encryptedData: new Uint8Array([1]),
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
  });

  describe("messages", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([5, 6, 7]);

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          senderId: "member-1",
          timestamp: now,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.senderId).toBe("member-1");
      expect(rows[0]?.archived).toBe(false);
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
          senderId: "m1",
          timestamp: now,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(channels).where(eq(channels.id, channelId)).run();
      const rows = db.select().from(messages).where(eq(messages.id, msgId)).all();
      expect(rows).toHaveLength(0);
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
          senderId: "m1",
          sortOrder: 5,
          encryptedData: new Uint8Array([1, 2]),
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
  });

  describe("notes", () => {
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
          encryptedData: new Uint8Array([1]),
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
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(notes).where(eq(notes.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.memberId).toBeNull();
    });
  });

  describe("polls", () => {
    it("round-trips with all T3 fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(polls)
        .values({
          id,
          systemId,
          createdByMemberId: "member-1",
          kind: "standard",
          endsAt: now + 86400000,
          allowMultipleVotes: true,
          maxVotesPerMember: 3,
          allowAbstain: true,
          allowVeto: false,
          encryptedData: new Uint8Array([1, 2]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe("standard");
      expect(rows[0]?.status).toBe("open");
      expect(rows[0]?.allowMultipleVotes).toBe(true);
      expect(rows[0]?.maxVotesPerMember).toBe(3);
    });

    it("rejects invalid kind via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(polls)
          .values({
            id: crypto.randomUUID(),
            systemId,
            createdByMemberId: "m1",
            kind: "invalid" as "standard",
            allowMultipleVotes: false,
            maxVotesPerMember: 1,
            allowAbstain: false,
            allowVeto: false,
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });

  describe("poll_votes", () => {
    it("round-trips voter JSON", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const voter = { type: "member", id: "member-1" };

      db.insert(pollVotes)
        .values({
          id,
          pollId,
          systemId,
          optionId: "opt-1",
          voter,
          votedAt: now,
        })
        .run();

      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.voter).toEqual(voter);
      expect(rows[0]?.isVeto).toBe(false);
      expect(rows[0]?.encryptedData).toBeNull();
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
          voter: { type: "member", id: "m1" },
          votedAt: now,
        })
        .run();

      db.delete(polls).where(eq(polls.id, pollId)).run();
      const rows = db.select().from(pollVotes).where(eq(pollVotes.id, voteId)).all();
      expect(rows).toHaveLength(0);
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
          createdByMemberId: "m1",
          targetMemberId: "m2",
          encryptedData: new Uint8Array([1, 2]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
      expect(rows[0]?.confirmedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
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
          createdByMemberId: "m1",
          targetMemberId: "m2",
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
