import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { polls } from "../schema/pg/communication.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCommunicationTables,
  insertAccount as insertAccountWith,
  insertMember as insertMemberWith,
  insertPoll as insertPollWith,
  insertSystem as insertSystemWith,
  setupCommunicationFixture,
  teardownCommunicationFixture,
  type CommunicationDb,
} from "./helpers/communication-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { MemberId, PollId } from "@pluralscape/types";

describe("PG communication schema — polls", () => {
  let client: PGlite;
  let db: CommunicationDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => insertMemberWith(db, systemId, id);
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
});
