import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { ROTATION_STATES, brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { initiateRotation } from "../../../../services/bucket/rotations/initiate.js";
import {
  assertApiError,
  genBucketId,
  makeAuth,
  noopAudit,
  spyAudit,
  asDb,
} from "../../../helpers/integration-setup.js";
import { insertBucket, insertContentTags, initiateParams } from "./internal.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { AccountId, BucketKeyRotationId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { bucketContentTags, bucketKeyRotations, bucketRotationItems, buckets, keyGrants } = schema;

describe("bucket/rotations — initiateRotation (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    // Privacy tables give us base tables + buckets + bucketContentTags + keyGrants
    await createPgPrivacyTables(client);
    // Key rotation tables depend on buckets
    await pgExec(client, PG_DDL.bucketKeyRotations);
    await pgExec(client, PG_DDL.bucketKeyRotationsIndexes);
    await pgExec(client, PG_DDL.bucketRotationItems);
    await pgExec(client, PG_DDL.bucketRotationItemsIndexes);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketRotationItems);
    await db.delete(bucketKeyRotations);
    await db.delete(keyGrants);
    await db.delete(bucketContentTags);
    await db.delete(buckets);
  });

  describe("initiateRotation", () => {
    it("creates a rotation record with initiated state", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 3);

      const result = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      expect(result.id).toMatch(/^bkr_/);
      expect(result.bucketId).toBe(bucketId);
      expect(result.state).toBe(ROTATION_STATES.initiated);
      expect(result.fromKeyVersion).toBe(1);
      expect(result.toKeyVersion).toBe(2);
      expect(result.totalItems).toBe(3);
      expect(result.completedItems).toBe(0);
      expect(result.failedItems).toBe(0);
      expect(result.completedAt).toBeNull();
    });

    it("creates rotation items for each content tag", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 2);

      const result = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const items = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.rotationId, result.id));
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.status).toBe("pending");
        expect(item.attempts).toBe(0);
      }
    });

    it("revokes existing key grants on initiation", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 1);

      // Insert an existing key grant
      const grantId = brandId<import("@pluralscape/types").KeyGrantId>(`kg_${crypto.randomUUID()}`);
      await db.insert(keyGrants).values({
        id: grantId,
        bucketId,
        systemId,
        friendAccountId: accountId,
        encryptedKey: Buffer.from("old-key"),
        keyVersion: 1,
        createdAt: toUnixMillis(Date.now()),
      });

      await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const grants = await db.select().from(keyGrants).where(eq(keyGrants.id, grantId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.revokedAt).not.toBeNull();
    });

    it("writes an audit entry on initiation", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 1);
      const audit = spyAudit();

      await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("bucket.key_rotation.initiated");
    });

    it("rejects for a non-existent bucket (FK violation)", async () => {
      const fakeBucketId = genBucketId();

      await expect(
        initiateRotation(asDb(db), systemId, fakeBucketId, initiateParams(), auth, noopAudit),
      ).rejects.toThrow();
    });

    it("throws ROTATION_IN_PROGRESS when a migrating rotation exists", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 1);

      // Insert an active rotation in migrating state
      await db.insert(bucketKeyRotations).values({
        id: brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`),
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.migrating,
        initiatedAt: toUnixMillis(Date.now()),
        totalItems: 1,
        completedItems: 0,
        failedItems: 0,
      });

      await assertApiError(
        initiateRotation(asDb(db), systemId, bucketId, initiateParams(3), auth, noopAudit),
        "ROTATION_IN_PROGRESS",
        409,
      );
    });

    it("cancels an existing initiated rotation and proceeds", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 1);

      const oldRotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: oldRotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.initiated,
        initiatedAt: toUnixMillis(Date.now()),
        totalItems: 1,
        completedItems: 0,
        failedItems: 0,
      });

      const result = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(3), auth, noopAudit);

      expect(result.state).toBe(ROTATION_STATES.initiated);
      expect(result.toKeyVersion).toBe(3);

      // Old rotation should be marked as failed
      const [oldRotation] = await db
        .select()
        .from(bucketKeyRotations)
        .where(eq(bucketKeyRotations.id, oldRotationId));
      expect(oldRotation?.state).toBe(ROTATION_STATES.failed);
    });

    it("handles zero content tags (empty rotation)", async () => {
      const bucketId = await insertBucket(db, systemId);
      // No content tags inserted

      const result = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      expect(result.totalItems).toBe(0);
      expect(result.state).toBe(ROTATION_STATES.initiated);
    });
  });
});
