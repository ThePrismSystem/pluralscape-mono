/**
 * SQLite fronting schema — fronting_comments table and fronting_sessions indexes.
 *
 * Covers: fronting_comments (13 tests), fronting_sessions indexes (1 test) = 14 tests total.
 *
 * Source: schema-sqlite-fronting.integration.test.ts (lines 823-1171)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { customFronts, frontingComments, frontingSessions } from "../schema/sqlite/fronting.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteFrontingTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, frontingSessions, customFronts, frontingComments };

describe("SQLite fronting schema — fronting_comments and indexes", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: SystemId, id?: string): MemberId =>
    sqliteInsertMember(db, systemId, id);

  function insertCustomFront(systemId: string, raw = crypto.randomUUID()): CustomFrontId {
    const id = brandId<CustomFrontId>(raw);
    const now = fixtureNow();
    db.insert(customFronts)
      .values({
        id,
        systemId: brandId<SystemId>(systemId),
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFrontingSession(
    systemId: SystemId,
    id = crypto.randomUUID(),
    memberId?: MemberId,
  ): FrontingSessionId {
    const sessionId = brandId<FrontingSessionId>(id);
    const now = fixtureNow();
    const resolvedMemberId = memberId ?? insertMember(systemId);
    db.insert(frontingSessions)
      .values({
        id: sessionId,
        systemId,
        startTime: now,
        memberId: resolvedMemberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return sessionId;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteFrontingTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(frontingComments).run();
    db.delete(frontingSessions).run();
    db.delete(customFronts).run();
  });

  describe("fronting_comments", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.frontingSessionId).toBe(sessionId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("restricts session deletion when referenced by comment", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db.delete(frontingSessions).where(eq(frontingSessions.id, sessionId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const commentId = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id: commentId,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(frontingComments)
        .where(eq(frontingComments.id, commentId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent sessionId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(frontingComments)
          .values({
            id: brandId<FrontingCommentId>(crypto.randomUUID()),
            frontingSessionId: brandId<FrontingSessionId>("nonexistent"),
            systemId,
            memberId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips memberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("defaults memberId to null when customFrontId is provided", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          customFrontId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });

    it("restricts member deletion when referenced by comment", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("rejects nonexistent memberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(frontingComments)
          .values({
            id: brandId<FrontingCommentId>(crypto.randomUUID()),
            frontingSessionId: sessionId,
            systemId,
            memberId: brandId<MemberId>("nonexistent"),
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
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_comments (id, fronting_session_id, system_id, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), sessionId, systemId, memberId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_comments (id, fronting_session_id, system_id, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), sessionId, systemId, memberId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(frontingComments)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(frontingComments.id, id))
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("fronting_sessions indexes", () => {
    it("creates partial index for active fronters", () => {
      const indexes = client
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'fronting_sessions'`,
        )
        .all() as Array<{ name: string; sql: string | null }>;
      const activeIdx = indexes.find((i) => i.name === "fronting_sessions_active_idx");
      expect(activeIdx?.sql).toMatch(/WHERE.*end_time IS NULL/i);
    });
  });
});
