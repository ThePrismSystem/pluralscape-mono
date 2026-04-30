/**
 * SQLite communication schema — poll_votes table.
 *
 * Covers: poll_votes (11 tests).
 *
 * Source: schema-sqlite-communication-poll-votes-acknowledgements.integration.test.ts (lines 62-316)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { polls, pollVotes } from "../schema/sqlite/communication.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertPoll,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { MemberId, PollOptionId, PollVoteId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, polls, pollVotes };

describe("SQLite communication schema — poll_votes", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertPoll = (systemId: string, opts?: Parameters<typeof sqliteInsertPoll>[2]) =>
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
    db.delete(pollVotes).run();
    db.delete(polls).run();
  });

  describe("poll_votes", () => {
    it("round-trips with encryptedData", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const pollId = insertPoll(systemId);
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();
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
      const now = fixtureNow();

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
      const voteId = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const voteId = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();
      const votedAt = fixtureNow();

      db.insert(pollVotes)
        .values({
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
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const id = brandId<PollVoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
});
