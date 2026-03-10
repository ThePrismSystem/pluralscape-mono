import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

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

  async function insertChannel(
    systemId: string,
    opts: {
      id?: string;
      type?: "category" | "channel";
      parentId?: string;
      sortOrder?: number;
    } = {},
  ): Promise<string> {
    const id = opts.id ?? crypto.randomUUID();
    const now = Date.now();
    await db.insert(channels).values({
      id,
      systemId,
      type: opts.type ?? "channel",
      parentId: opts.parentId ?? null,
      sortOrder: opts.sortOrder ?? 0,
      encryptedData: new Uint8Array([1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertPoll(
    systemId: string,
    opts: { id?: string; kind?: "standard" | "custom" } = {},
  ): Promise<string> {
    const id = opts.id ?? crypto.randomUUID();
    const now = Date.now();
    await db.insert(polls).values({
      id,
      systemId,
      createdByMemberId: crypto.randomUUID(),
      kind: opts.kind ?? "standard",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
      encryptedData: new Uint8Array([1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("channels", () => {
    it("round-trips with encrypted_data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const data = new Uint8Array([10, 20, 30]);
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      await expect(
        db.insert(channels).values({
          id: crypto.randomUUID(),
          systemId,
          type: "invalid" as "channel",
          sortOrder: 0,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative sort_order via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(channels).values({
          id: crypto.randomUUID(),
          systemId,
          type: "channel",
          sortOrder: -1,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("self-ref FK sets parentId to null on parent delete", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const parentId = await insertChannel(systemId, { type: "category" });
      const childId = await insertChannel(systemId, { parentId });

      await db.delete(channels).where(eq(channels.id, parentId));
      const rows = await db.select().from(channels).where(eq(channels.id, childId));
      expect(rows[0]?.parentId).toBeNull();
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
  });

  describe("messages", () => {
    it("round-trips with all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([5, 6, 7]);

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        senderId: "member-1",
        replyToId: null,
        timestamp: now,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.senderId).toBe("member-1");
      expect(rows[0]?.editedAt).toBeNull();
      expect(rows[0]?.archived).toBe(false);
    });

    it("cascades on channel deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = Date.now();
      const msgId = crypto.randomUUID();

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        senderId: "m1",
        timestamp: now,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(channels).where(eq(channels.id, channelId));
      const rows = await db.select().from(messages).where(eq(messages.id, msgId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = Date.now();
      const msgId = crypto.randomUUID();

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        senderId: "m1",
        timestamp: now,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(messages).where(eq(messages.id, msgId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("board_messages", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(boardMessages).values({
        id,
        systemId,
        senderId: "m1",
        sortOrder: 5,
        encryptedData: new Uint8Array([1, 2]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.pinned).toBe(false);
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(boardMessages).values({
        id,
        systemId,
        senderId: "m1",
        sortOrder: 0,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(boardMessages).where(eq(boardMessages.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("notes", () => {
    it("round-trips with nullable memberId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1, 2]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
    });

    it("sets memberId to null on member deletion (SET NULL)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notes).values({
        id,
        systemId,
        memberId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });

    it("defaults archived to false", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notes).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(notes).where(eq(notes.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("polls", () => {
    it("round-trips with all T3 fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const endsAt = now + 86400000;

      await db.insert(polls).values({
        id,
        systemId,
        createdByMemberId: "member-1",
        kind: "standard",
        status: "open",
        endsAt,
        allowMultipleVotes: true,
        maxVotesPerMember: 3,
        allowAbstain: true,
        allowVeto: false,
        encryptedData: new Uint8Array([1, 2]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(polls).where(eq(polls.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe("standard");
      expect(rows[0]?.status).toBe("open");
      expect(rows[0]?.closedAt).toBeNull();
      expect(rows[0]?.endsAt).toBe(endsAt);
      expect(rows[0]?.allowMultipleVotes).toBe(true);
      expect(rows[0]?.maxVotesPerMember).toBe(3);
      expect(rows[0]?.allowAbstain).toBe(true);
      expect(rows[0]?.allowVeto).toBe(false);
    });

    it("defaults status to 'open'", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);

      const rows = await db.select().from(polls).where(eq(polls.id, pollId));
      expect(rows[0]?.status).toBe("open");
    });

    it("rejects invalid kind via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(polls).values({
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
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid status via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(polls).values({
          id: crypto.randomUUID(),
          systemId,
          createdByMemberId: "m1",
          kind: "standard",
          status: "invalid" as "open",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
          encryptedData: new Uint8Array([1]),
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
  });

  describe("poll_votes", () => {
    it("round-trips voter JSON", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const voter = { type: "member", id: "member-1" };

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        optionId: "opt-1",
        voter,
        votedAt: now,
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.voter).toEqual(voter);
      expect(rows[0]?.isVeto).toBe(false);
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("allows nullable encryptedData", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(pollVotes).values({
        id,
        pollId,
        systemId,
        voter: { type: "member", id: "m1" },
        votedAt: now,
        encryptedData: new Uint8Array([1, 2, 3]),
      });

      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, id));
      expect(rows[0]?.encryptedData).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("cascades on poll deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const voteId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(pollVotes).values({
        id: voteId,
        pollId,
        systemId,
        voter: { type: "member", id: "m1" },
        votedAt: now,
      });

      await db.delete(polls).where(eq(polls.id, pollId));
      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, voteId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const pollId = await insertPoll(systemId);
      const voteId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(pollVotes).values({
        id: voteId,
        pollId,
        systemId,
        voter: { type: "member", id: "m1" },
        votedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(pollVotes).where(eq(pollVotes.id, voteId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("acknowledgements", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: "m1",
        targetMemberId: "m2",
        encryptedData: new Uint8Array([1, 2]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
      expect(rows[0]?.confirmedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips confirmed state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: "m1",
        targetMemberId: "m2",
        confirmed: true,
        confirmedAt: now,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.confirmed).toBe(true);
      expect(rows[0]?.confirmedAt).toBe(now);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: "m1",
        targetMemberId: "m2",
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(0);
    });
  });
});
