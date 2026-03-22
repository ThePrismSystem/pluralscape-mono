import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { customFronts, frontingComments, frontingSessions } from "../schema/sqlite/fronting.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteFrontingTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  members,
  frontingSessions,
  customFronts,
  frontingComments,
};

describe("SQLite fronting schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);

  function insertCustomFront(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(customFronts)
      .values({
        id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFrontingSession(
    systemId: string,
    id = crypto.randomUUID(),
    memberId?: string,
  ): string {
    const now = Date.now();
    const resolvedMemberId = memberId ?? insertMember(systemId);
    db.insert(frontingSessions)
      .values({
        id,
        systemId,
        startTime: now,
        memberId: resolvedMemberId,
        encryptedData: testBlob(),
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

  describe("fronting_sessions", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          memberId,
          startTime: now,
          endTime: now + 1000,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.startTime).toBe(now);
      expect(rows[0]?.endTime).toBe(now + 1000);
    });

    it("allows nullable endTime for open sessions", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          memberId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.endTime).toBeNull();
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          memberId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.id, sessionId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            memberId: "nonexistent-member",
            startTime: now,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects endTime less than or equal to startTime via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId,
            startTime: now,
            endTime: now,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);

      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId,
            startTime: now,
            endTime: now - 1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("allows overlapping sessions for the same system", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId1 = insertMember(systemId);
      const memberId2 = insertMember(systemId);
      const now = Date.now();

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      db.insert(frontingSessions)
        .values({
          id: id1,
          systemId,
          memberId: memberId1,
          startTime: now,
          endTime: now + 2000,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(frontingSessions)
        .values({
          id: id2,
          systemId,
          memberId: memberId2,
          startTime: now + 1000,
          endTime: now + 3000,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.systemId, systemId))
        .all();
      expect(rows).toHaveLength(2);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const cfId = insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          memberId,
          customFrontId: cfId,
          linkedStructure: { entityType: "subsystem", entityId: "r-1" },
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.customFrontId).toBe(cfId);
      expect(rows[0]?.linkedStructure).toEqual({ entityType: "subsystem", entityId: "r-1" });
    });

    it("defaults T3 metadata columns to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          customFrontId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.linkedStructure).toBeNull();
    });

    it("sets memberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const customFrontId = insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          memberId,
          customFrontId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });

    it("rejects nonexistent memberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: crypto.randomUUID(),
            systemId,
            startTime: now,
            memberId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("sets customFrontId to null on custom front deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const customFrontId = insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          memberId,
          customFrontId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(customFronts).where(eq(customFronts.id, customFrontId)).run();
      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.customFrontId).toBeNull();
    });

    it("rejects nonexistent customFrontId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: crypto.randomUUID(),
            systemId,
            startTime: now,
            customFrontId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects version < 1 via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, member_id, start_time, encrypted_data, created_at, updated_at, version) VALUES (?, ?, ?, ?, X'0102', ?, ?, 0)",
          )
          .run(crypto.randomUUID(), systemId, memberId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects fronting session with no subject", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, start_time, encrypted_data, created_at, updated_at) VALUES (?, ?, ?, X'0102', ?, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("accepts fronting session with only customFrontId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          customFrontId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBe(customFrontId);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertFrontingSession(systemId);

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, member_id, start_time, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, memberId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, member_id, start_time, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, memberId, now, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertFrontingSession(systemId);
      const now = Date.now();

      db.update(frontingSessions)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(frontingSessions.id, id))
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("custom_fronts", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults archived to false, archivedAt to null, and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects version < 1 via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version) VALUES (?, ?, X'0102', ?, ?, 0)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 1, NULL)",
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
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertCustomFront(systemId);
      const now = Date.now();

      db.update(customFronts)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(customFronts.id, id))
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("fronting_comments", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
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
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on session deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id: commentId,
          frontingSessionId: sessionId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(frontingSessions).where(eq(frontingSessions.id, sessionId)).run();
      const rows = db
        .select()
        .from(frontingComments)
        .where(eq(frontingComments.id, commentId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id: commentId,
          frontingSessionId: sessionId,
          systemId,
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
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingComments)
          .values({
            id: crypto.randomUUID(),
            frontingSessionId: "nonexistent",
            systemId,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          memberId,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("defaults memberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });

    it("sets memberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

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

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(frontingComments).where(eq(frontingComments.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });

    it("rejects nonexistent memberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(frontingComments)
          .values({
            id: crypto.randomUUID(),
            frontingSessionId: sessionId,
            systemId,
            memberId: "nonexistent",
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
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
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
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
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
      const sessionId = insertFrontingSession(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_comments (id, fronting_session_id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), sessionId, systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_comments (id, fronting_session_id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), sessionId, systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(frontingComments)
        .values({
          id,
          frontingSessionId: sessionId,
          systemId,
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
      expect(activeIdx).toBeDefined();
      expect(activeIdx?.sql).toMatch(/WHERE.*end_time IS NULL/i);
    });
  });
});
