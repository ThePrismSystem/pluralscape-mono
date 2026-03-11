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
import { systems } from "../schema/pg/systems.js";

import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
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

  async function insertFrontingSession(
    systemId: string,
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
    await db.insert(frontingSessions).values({
      id,
      systemId,
      startTime: now,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
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
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        endTime: now + 60000,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
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
      const sessionId = await insertFrontingSession(systemId);

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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects endTime <= startTime via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          endTime: now,
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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows overlapping sessions for the same system", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      await db.insert(frontingSessions).values({
        id: id1,
        systemId,
        startTime: now,
        endTime: now + 60000,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(frontingSessions).values({
        id: id2,
        systemId,
        startTime: now + 30000,
        endTime: now + 90000,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId: "member-1",
        frontingType: "fronting",
        customFrontId: "custom-1",
        linkedStructure: { regionId: "r-1" },
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBe("member-1");
      expect(rows[0]?.frontingType).toBe("fronting");
      expect(rows[0]?.customFrontId).toBe("custom-1");
      expect(rows[0]?.linkedStructure).toEqual({ regionId: "r-1" });
    });

    it("defaults T3 metadata columns to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.frontingType).toBeNull();
      expect(rows[0]?.customFrontId).toBeNull();
      expect(rows[0]?.linkedStructure).toBeNull();
    });

    it("rejects invalid frontingType via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(frontingSessions).values({
          id: crypto.randomUUID(),
          systemId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          frontingType: "invalid" as "fronting",
        }),
      ).rejects.toThrow();
    });
  });

  describe("switches", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(switches).values({
        id,
        systemId,
        timestamp: now,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db.select().from(switches).where(eq(switches.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
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
        encryptedData: testBlob(new Uint8Array([1])),
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
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        }),
      ).rejects.toThrow();
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
  });

  describe("fronting_comments", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sessionId = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingComments).values({
        id,
        sessionId,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sessionId).toBe(sessionId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sessionId = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        sessionId,
        systemId,
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
      const sessionId = await insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id: commentId,
        sessionId,
        systemId,
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
      const sessionId = await insertFrontingSession(systemId);
      const commentId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id: commentId,
        sessionId,
        systemId,
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
          sessionId: "nonexistent",
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips memberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sessionId = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        sessionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId: "member-1",
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBe("member-1");
    });

    it("defaults memberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sessionId = await insertFrontingSession(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(frontingComments).values({
        id,
        sessionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });
  });
});
