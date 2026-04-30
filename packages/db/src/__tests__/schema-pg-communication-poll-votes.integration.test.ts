import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { polls, pollVotes } from "../schema/pg/communication.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCommunicationTables,
  insertAccount as insertAccountWith,
  insertPoll as insertPollWith,
  insertSystem as insertSystemWith,
  setupCommunicationFixture,
  teardownCommunicationFixture,
  type CommunicationDb,
} from "./helpers/communication-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { MemberId, PollOptionId, PollVoteId } from "@pluralscape/types";

describe("PG communication schema — poll votes", () => {
  let client: PGlite;
  let db: CommunicationDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertPoll = (
    systemId: string,
    opts?: Parameters<typeof insertPollWith>[2],
  ): ReturnType<typeof insertPollWith> => insertPollWith(db, systemId, opts);

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
});
