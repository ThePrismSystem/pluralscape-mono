import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  customFronts,
  frontingComments,
  frontingSessions,
  switches,
} from "../schema/pg/fronting.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  frontingSessions,
  switches,
  customFronts,
  frontingComments,
};

describe("PG fronting schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);

  async function insertCustomFront(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(customFronts).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertFrontingSession(
    systemId: string,
    id = crypto.randomUUID(),
  ): Promise<{ id: string; startTime: number }> {
    const now = Date.now();
    const memberId = await insertMember(systemId);
    await db.insert(frontingSessions).values({
      id,
      systemId,
      startTime: now,
      memberId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return { id, startTime: now };
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("fronting_sessions", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        endTime: now + 60000,
        memberId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.startTime).toBe(now);
      expect(rows[0]?.endTime).toBe(now + 60000);
    });

    it("allows nullable endTime for open sessions", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.endTime).toBeNull();
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId } = await insertFrontingSession(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.id, sessionId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          startTime: now,
          memberId: "nonexistent-member",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects endTime <= startTime via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          endTime: now,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          endTime: now - 1000,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows overlapping sessions for the same system", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      await db.insert(frontingSessions).values({
        id: id1,
        systemId,
        startTime: now,
        endTime: now + 60000,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(frontingSessions).values({
        id: id2,
        systemId,
        startTime: now + 30000,
        endTime: now + 90000,
        memberId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.systemId, systemId));
      expect(rows).toHaveLength(2);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const cfId = await insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId,
        frontingType: "fronting",
        customFrontId: cfId,
        linkedStructure: { entityType: "subsystem", entityId: "r-1" },
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.frontingType).toBe("fronting");
      expect(rows[0]?.customFrontId).toBe(cfId);
      expect(rows[0]?.linkedStructure).toEqual({ entityType: "subsystem", entityId: "r-1" });
    });

    it("defaults T3 metadata columns to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.frontingType).toBe("fronting");
      expect(rows[0]?.customFrontId).toBe(customFrontId);
      expect(rows[0]?.linkedStructure).toBeNull();
    });

    it("sets memberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const customFrontId = await insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });

    it("rejects nonexistent memberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          memberId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("sets customFrontId to null on custom front deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(customFronts).where(eq(customFronts.id, customFrontId));
      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.customFrontId).toBeNull();
    });

    it("rejects nonexistent customFrontId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          customFrontId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid frontingType via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          frontingType: "invalid" as "fronting",
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("rejects version < 1 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 0)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects fronting session with no subject", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("accepts fronting session with only customFrontId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBe(customFrontId);
    });
  });

  describe("switches", () => {
    it("inserts with memberIds and round-trips the array", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const memberIds = ["mem_test1", "mem_test2"] as const;

      await db.insert(switches).values({
        id,
        systemId,
        timestamp: now,
        memberIds,
        createdAt: now,
      });

      const rows = await db.select().from(switches).where(eq(switches.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberIds).toEqual(memberIds);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.timestamp).toBe(now);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(switches).values({
        id,
        systemId,
        timestamp: now,
        memberIds: ["mem_test1", "mem_test2"],
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(switches).where(eq(switches.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(switches).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          timestamp: now,
          memberIds: ["mem_test1", "mem_test2"],
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects empty memberIds array via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO switches (id, system_id, timestamp, member_ids, created_at) VALUES ($1, $2, $3, '[]'::jsonb, $4)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("accepts single-element memberIds array (minimum valid)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(switches).values({
        id,
        systemId,
        timestamp: now,
        memberIds: ["mem_single"],
        createdAt: now,
      });

      const rows = await db.select().from(switches).where(eq(switches.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberIds).toEqual(["mem_single"]);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(switches).values({
        id,
        systemId,
        timestamp: now,
        memberIds: ["mem_test1"],
        createdAt: now,
      });

      const rows = await db.select().from(switches).where(eq(switches.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects version < 1 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          `INSERT INTO switches (id, system_id, timestamp, member_ids, created_at, version) VALUES ($1, $2, $3, '["m1"]'::jsonb, $4, 0)`,
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("custom_fronts", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(customFronts).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(customFronts).where(eq(customFronts.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults archived to false, archivedAt to null, and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(customFronts).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(customFronts).where(eq(customFronts.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(customFronts).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(customFronts).where(eq(customFronts.id, id));
      expect(rows).toHaveLength(0);
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(customFronts).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(customFronts).where(eq(customFronts.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects version < 1 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 0)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("fronting_comments", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.frontingSessionId).toBe(sessionId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on session deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(frontingSessions).where(eq(frontingSessions.id, sessionId));
      const rows = await db
        .select()
        .from(frontingComments)
        .where(eq(frontingComments.id, commentId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(frontingComments)
        .where(eq(frontingComments.id, commentId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent sessionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingComments).values({
          id: crypto.randomUUID(),
          frontingSessionId: "nonexistent",
          systemId,
          sessionStartTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips memberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("defaults memberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });

    it("sets memberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });

    it("rejects nonexistent memberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const now = Date.now();

      await expect(
        db.insert(frontingComments).values({
          id: crypto.randomUUID(),
          frontingSessionId: sessionId,
          systemId,
          sessionStartTime,
          memberId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("fronting_sessions indexes", () => {
    it("creates partial index for active fronters", async () => {
      const result = await client.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'fronting_sessions' AND indexname = 'fronting_sessions_active_idx'`,
      );
      const rows = result.rows as Array<{ indexname: string; indexdef: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.indexdef).toMatch(/WHERE.*end_time.*IS NULL/i);
    });
  });
});
