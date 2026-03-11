import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bucketKeyRotations, bucketRotationItems } from "../schema/pg/key-rotation.js";
import { buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgKeyRotationTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { systems, buckets, bucketKeyRotations, bucketRotationItems };

describe("PG key-rotation schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertBucket(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertRotation(
    bucketId: string,
    overrides: Partial<{
      id: string;
      fromKeyVersion: number;
      toKeyVersion: number;
      totalItems: number;
      initiatedAt: number;
    }> = {},
  ): Promise<string> {
    const id = overrides.id ?? crypto.randomUUID();
    await db.insert(bucketKeyRotations).values({
      id,
      bucketId,
      fromKeyVersion: overrides.fromKeyVersion ?? 1,
      toKeyVersion: overrides.toKeyVersion ?? 2,
      totalItems: overrides.totalItems ?? 10,
      initiatedAt: overrides.initiatedAt ?? Date.now(),
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgKeyRotationTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("bucket_key_rotations", () => {
    it("inserts and round-trips all columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(bucketKeyRotations).values({
        id,
        bucketId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        totalItems: 5,
        initiatedAt: now,
      });

      const rows = await db.select().from(bucketKeyRotations).where(eq(bucketKeyRotations.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucketId).toBe(bucketId);
      expect(rows[0]?.fromKeyVersion).toBe(1);
      expect(rows[0]?.toKeyVersion).toBe(2);
      expect(rows[0]?.state).toBe("initiated");
      expect(rows[0]?.totalItems).toBe(5);
      expect(rows[0]?.completedItems).toBe(0);
      expect(rows[0]?.failedItems).toBe(0);
      expect(rows[0]?.completedAt).toBeNull();
    });

    it("rejects invalid state via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(bucketKeyRotations).values({
          id: crypto.randomUUID(),
          bucketId,
          fromKeyVersion: 1,
          toKeyVersion: 2,
          state: "invalid" as "initiated",
          totalItems: 1,
          initiatedAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("rejects toKeyVersion <= fromKeyVersion via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(bucketKeyRotations).values({
          id: crypto.randomUUID(),
          bucketId,
          fromKeyVersion: 3,
          toKeyVersion: 2,
          totalItems: 1,
          initiatedAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("rejects toKeyVersion == fromKeyVersion via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(bucketKeyRotations).values({
          id: crypto.randomUUID(),
          bucketId,
          fromKeyVersion: 2,
          toKeyVersion: 2,
          totalItems: 1,
          initiatedAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("allows updating state through valid progression", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const id = crypto.randomUUID();

      await db.insert(bucketKeyRotations).values({
        id,
        bucketId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        totalItems: 1,
        initiatedAt: Date.now(),
      });

      for (const nextState of ["migrating", "sealing", "completed"] as const) {
        await db
          .update(bucketKeyRotations)
          .set({ state: nextState })
          .where(eq(bucketKeyRotations.id, id));
        const rows = await db
          .select()
          .from(bucketKeyRotations)
          .where(eq(bucketKeyRotations.id, id));
        expect(rows[0]?.state).toBe(nextState);
      }
    });

    it("rejects completedItems + failedItems > totalItems via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const id = crypto.randomUUID();

      await db.insert(bucketKeyRotations).values({
        id,
        bucketId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        totalItems: 5,
        initiatedAt: Date.now(),
      });

      await expect(
        db
          .update(bucketKeyRotations)
          .set({ completedItems: 4, failedItems: 3 })
          .where(eq(bucketKeyRotations.id, id)),
      ).rejects.toThrow();
    });

    it("cascades delete when bucket is deleted", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);

      await db.delete(buckets).where(eq(buckets.id, bucketId));

      const rows = await db
        .select()
        .from(bucketKeyRotations)
        .where(eq(bucketKeyRotations.id, rotationId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("bucket_rotation_items", () => {
    it("inserts and round-trips all columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);
      const id = crypto.randomUUID();

      await db.insert(bucketRotationItems).values({
        id,
        rotationId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        status: "claimed",
        claimedBy: "worker-1",
        claimedAt: Date.now(),
        attempts: 1,
      });

      const rows = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.rotationId).toBe(rotationId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.status).toBe("claimed");
      expect(rows[0]?.claimedBy).toBe("worker-1");
      expect(rows[0]?.attempts).toBe(1);
      expect(rows[0]?.completedAt).toBeNull();
    });

    it("defaults status to pending and attempts to 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);
      const id = crypto.randomUUID();

      await db.insert(bucketRotationItems).values({
        id,
        rotationId,
        entityType: "journal-entry",
        entityId: crypto.randomUUID(),
      });

      const rows = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, id));
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.attempts).toBe(0);
      expect(rows[0]?.claimedBy).toBeNull();
      expect(rows[0]?.claimedAt).toBeNull();
    });

    it("rejects invalid status via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);

      await expect(
        db.insert(bucketRotationItems).values({
          id: crypto.randomUUID(),
          rotationId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          status: "invalid" as "pending",
        }),
      ).rejects.toThrow();
    });

    it("cascades delete when rotation is deleted", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);
      const itemId = crypto.randomUUID();

      await db.insert(bucketRotationItems).values({
        id: itemId,
        rotationId,
        entityType: "member",
        entityId: crypto.randomUUID(),
      });

      await db.delete(bucketKeyRotations).where(eq(bucketKeyRotations.id, rotationId));

      const rows = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, itemId));
      expect(rows).toHaveLength(0);
    });

    it("cascades delete transitively when bucket is deleted", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const rotationId = await insertRotation(bucketId);
      const itemId = crypto.randomUUID();

      await db.insert(bucketRotationItems).values({
        id: itemId,
        rotationId,
        entityType: "member",
        entityId: crypto.randomUUID(),
      });

      await db.delete(buckets).where(eq(buckets.id, bucketId));

      const rotationRows = await db
        .select()
        .from(bucketKeyRotations)
        .where(eq(bucketKeyRotations.id, rotationId));
      const itemRows = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, itemId));
      expect(rotationRows).toHaveLength(0);
      expect(itemRows).toHaveLength(0);
    });
  });
});
