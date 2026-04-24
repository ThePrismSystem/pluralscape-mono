import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bucketKeyRotations, bucketRotationItems } from "../schema/sqlite/key-rotation.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteKeyRotationTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  AccountId,
  BucketId,
  BucketKeyRotationId,
  BucketRotationItemId,
  SystemId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { systems, buckets, bucketKeyRotations, bucketRotationItems };

describe("SQLite key-rotation schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): BucketId {
    const now = Date.now();
    db.insert(buckets)
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

  function insertRotation(
    bucketId: BucketId,
    systemId: SystemId,
    overrides: Partial<{
      id: BucketKeyRotationId;
      fromKeyVersion: number;
      toKeyVersion: number;
      totalItems: number;
      initiatedAt: number;
    }> = {},
  ): BucketKeyRotationId {
    const id = overrides.id ?? brandId<BucketKeyRotationId>(crypto.randomUUID());
    db.insert(bucketKeyRotations)
      .values({
        id,
        bucketId,
        systemId,
        fromKeyVersion: overrides.fromKeyVersion ?? 1,
        toKeyVersion: overrides.toKeyVersion ?? 2,
        totalItems: overrides.totalItems ?? 10,
        initiatedAt: overrides.initiatedAt ?? Date.now(),
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteKeyRotationTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("bucket_key_rotations", () => {
    it("inserts and round-trips all columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const now = Date.now();
      const id = brandId<BucketKeyRotationId>(crypto.randomUUID());

      db.insert(bucketKeyRotations)
        .values({
          id,
          bucketId,
          systemId,
          fromKeyVersion: 1,
          toKeyVersion: 2,
          totalItems: 5,
          initiatedAt: now,
        })
        .run();

      const rows = db.select().from(bucketKeyRotations).where(eq(bucketKeyRotations.id, id)).all();
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

    it("rejects invalid state via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(bucketKeyRotations)
          .values({
            id: brandId<BucketKeyRotationId>(crypto.randomUUID()),
            bucketId,
            systemId,
            fromKeyVersion: 1,
            toKeyVersion: 2,
            state: "invalid" as "initiated",
            totalItems: 1,
            initiatedAt: Date.now(),
          })
          .run(),
      ).toThrow();
    });

    it("rejects toKeyVersion <= fromKeyVersion via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(bucketKeyRotations)
          .values({
            id: brandId<BucketKeyRotationId>(crypto.randomUUID()),
            bucketId,
            systemId,
            fromKeyVersion: 3,
            toKeyVersion: 2,
            totalItems: 1,
            initiatedAt: Date.now(),
          })
          .run(),
      ).toThrow();
    });

    it("rejects toKeyVersion == fromKeyVersion via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(bucketKeyRotations)
          .values({
            id: brandId<BucketKeyRotationId>(crypto.randomUUID()),
            bucketId,
            systemId,
            fromKeyVersion: 2,
            toKeyVersion: 2,
            totalItems: 1,
            initiatedAt: Date.now(),
          })
          .run(),
      ).toThrow();
    });

    it("allows updating state through valid progression", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const id = brandId<BucketKeyRotationId>(crypto.randomUUID());

      db.insert(bucketKeyRotations)
        .values({
          id,
          bucketId,
          systemId,
          fromKeyVersion: 1,
          toKeyVersion: 2,
          totalItems: 1,
          initiatedAt: Date.now(),
        })
        .run();

      for (const nextState of ["migrating", "sealing", "completed"] as const) {
        db.update(bucketKeyRotations)
          .set({ state: nextState })
          .where(eq(bucketKeyRotations.id, id))
          .run();
        const rows = db
          .select()
          .from(bucketKeyRotations)
          .where(eq(bucketKeyRotations.id, id))
          .all();
        expect(rows[0]?.state).toBe(nextState);
      }
    });

    it("rejects completedItems + failedItems > totalItems via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const id = brandId<BucketKeyRotationId>(crypto.randomUUID());

      db.insert(bucketKeyRotations)
        .values({
          id,
          bucketId,
          systemId,
          fromKeyVersion: 1,
          toKeyVersion: 2,
          totalItems: 5,
          initiatedAt: Date.now(),
        })
        .run();

      expect(() =>
        db
          .update(bucketKeyRotations)
          .set({ completedItems: 4, failedItems: 3 })
          .where(eq(bucketKeyRotations.id, id))
          .run(),
      ).toThrow();
    });

    it("cascades delete when bucket is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();

      const rows = db
        .select()
        .from(bucketKeyRotations)
        .where(eq(bucketKeyRotations.id, rotationId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("bucket_rotation_items", () => {
    it("inserts and round-trips all columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);
      const id = brandId<BucketRotationItemId>(crypto.randomUUID());

      db.insert(bucketRotationItems)
        .values({
          id,
          rotationId,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          status: "claimed",
          claimedBy: "worker-1",
          claimedAt: Date.now(),
          attempts: 1,
        })
        .run();

      const rows = db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.rotationId).toBe(rotationId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.status).toBe("claimed");
      expect(rows[0]?.claimedBy).toBe("worker-1");
      expect(rows[0]?.attempts).toBe(1);
      expect(rows[0]?.completedAt).toBeNull();
    });

    it("defaults status to pending and attempts to 0", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);
      const id = brandId<BucketRotationItemId>(crypto.randomUUID());

      db.insert(bucketRotationItems)
        .values({
          id,
          rotationId,
          systemId,
          entityType: "journal-entry",
          entityId: crypto.randomUUID(),
        })
        .run();

      const rows = db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, id))
        .all();
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.attempts).toBe(0);
      expect(rows[0]?.claimedBy).toBeNull();
      expect(rows[0]?.claimedAt).toBeNull();
    });

    it("rejects invalid status via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);

      expect(() =>
        db
          .insert(bucketRotationItems)
          .values({
            id: brandId<BucketRotationItemId>(crypto.randomUUID()),
            rotationId,
            systemId,
            entityType: "member",
            entityId: crypto.randomUUID(),
            status: "invalid" as "pending",
          })
          .run(),
      ).toThrow();
    });

    it("cascades delete when rotation is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);
      const itemId = brandId<BucketRotationItemId>(crypto.randomUUID());

      db.insert(bucketRotationItems)
        .values({
          id: itemId,
          rotationId,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
        })
        .run();

      db.delete(bucketKeyRotations).where(eq(bucketKeyRotations.id, rotationId)).run();

      const rows = db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, itemId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades delete transitively when bucket is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const rotationId = insertRotation(bucketId, systemId);
      const itemId = brandId<BucketRotationItemId>(crypto.randomUUID());

      db.insert(bucketRotationItems)
        .values({
          id: itemId,
          rotationId,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
        })
        .run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();

      const rotationRows = db
        .select()
        .from(bucketKeyRotations)
        .where(eq(bucketKeyRotations.id, rotationId))
        .all();
      const itemRows = db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.id, itemId))
        .all();
      expect(rotationRows).toHaveLength(0);
      expect(itemRows).toHaveLength(0);
    });
  });
});
