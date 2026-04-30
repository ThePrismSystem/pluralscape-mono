/**
 * SQLite communication schema — notes and polls tables.
 *
 * Covers: notes (8 tests), polls (13 tests) = 21 tests.
 *
 * Source: schema-sqlite-communication.integration.test.ts (lines 584-1014)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { notes, polls } from "../schema/sqlite/communication.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertPoll,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { MemberId, NoteId, PollId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, notes, polls };

describe("SQLite communication schema — notes and polls", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => sqliteInsertMember(db, systemId, id);
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
    db.delete(polls).run();
    db.delete(notes).run();
  });

  describe("notes", () => {
    it("round-trips system-wide note (null author)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(notes)
        .values({
          id,
          systemId,
          authorEntityType: "member",
          authorEntityId: brandId<MemberId>(memberId),
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
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const id = brandId<NoteId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(polls)
          .values({
            id: brandId<PollId>(crypto.randomUUID()),
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
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(polls)
        .values({
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(polls)
          .values({
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
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("sets createdByMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(polls)
        .values({
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
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(polls).where(eq(polls.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("rejects nonexistent createdByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(polls)
          .values({
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
      const id = brandId<PollId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

      db.update(polls).set({ archived: true, archivedAt: now }).where(eq(polls.id, pollId)).run();

      const rows = db.select().from(polls).where(eq(polls.id, pollId)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
