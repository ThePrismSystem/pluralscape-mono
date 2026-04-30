import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { ROTATION_ITEM_STATUSES, ROTATION_STATES, brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { claimRotationChunk } from "../../../services/bucket/rotations/claim.js";
import { completeRotationChunk } from "../../../services/bucket/rotations/complete.js";
import { initiateRotation } from "../../../services/bucket/rotations/initiate.js";
import { getRotationProgress } from "../../../services/bucket/rotations/queries.js";
import { retryRotation } from "../../../services/bucket/rotations/retry.js";
import {
  assertApiError,
  genBucketId,
  genRotationId,
  makeAuth,
  noopAudit,
  spyAudit,
  asDb,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { UnixMillis } from "@pluralscape/types";
import type {
  AccountId,
  BucketId,
  BucketKeyRotationId,
  BucketRotationItemId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags, bucketKeyRotations, bucketRotationItems, keyGrants } = schema;

describe("key-rotation progress/retry/lifecycle (PGlite integration)", () => {
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
    // Key rotation tables (bucketKeyRotations + bucketRotationItems) depend on buckets
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

  async function insertBucket(id?: BucketId): Promise<BucketId> {
    const resolvedId = id ?? genBucketId();
    const ts = toUnixMillis(Date.now());
    await db.insert(buckets).values({
      id: resolvedId,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<BucketId>(resolvedId);
  }

  async function insertContentTags(bucketId: BucketId, count: number): Promise<string[]> {
    const entityIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const entityId = crypto.randomUUID();
      entityIds.push(entityId);
      await db.insert(bucketContentTags).values({
        entityType: "member",
        entityId,
        bucketId,
        systemId,
      });
    }
    return entityIds;
  }

  function initiateParams(newKeyVersion = 2) {
    return {
      wrappedNewKey: "wrapped-key-base64",
      newKeyVersion,
      friendKeyGrants: [],
    };
  }

  describe("getRotationProgress", () => {
    it("returns accurate progress counters", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 4);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      // Claim and complete 2 of 4
      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 2 },
        auth,
      );

      await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        {
          items: claim.data.map((item) => ({
            itemId: item.id,
            status: "completed" as const,
          })),
        },
        auth,
        noopAudit,
      );

      const progress = await getRotationProgress(asDb(db), systemId, bucketId, rotation.id, auth);

      expect(progress.totalItems).toBe(4);
      expect(progress.completedItems).toBe(2);
      expect(progress.failedItems).toBe(0);
      expect(progress.state).toBe(ROTATION_STATES.migrating);
    });

    it("throws NOT_FOUND for a non-existent rotation", async () => {
      const bucketId = await insertBucket();
      const fakeRotationId = genRotationId();

      await assertApiError(
        getRotationProgress(asDb(db), systemId, bucketId, fakeRotationId, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("retryRotation", () => {
    it("resets only failed items and emits disambiguated audit detail", async () => {
      // Seed a rotation in `failed` state with a mix of statuses so the
      // reset count is strictly smaller than the total item count — this
      // makes the audit detail meaningful (a bare "N retries" number would
      // be ambiguous without the "N failed items → pending" framing).
      const bucketId = await insertBucket();
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);

      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.failed,
        initiatedAt: toUnixMillis(Date.now()),
        totalItems: 5,
        completedItems: 2,
        failedItems: 3,
      });

      // 2 completed + 3 failed + 0 pending/claimed. Only the 3 failed items
      // should be reset; the 2 completed items must stay untouched.
      const seedItem = async (
        status:
          | (typeof ROTATION_ITEM_STATUSES)["completed"]
          | (typeof ROTATION_ITEM_STATUSES)["failed"],
        completedAt: UnixMillis | null,
      ): Promise<BucketRotationItemId> => {
        const itemId = brandId<BucketRotationItemId>(`bri_${crypto.randomUUID()}`);
        await db.insert(bucketRotationItems).values({
          id: itemId,
          systemId,
          rotationId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          status,
          claimedBy: status === ROTATION_ITEM_STATUSES.failed ? "sess_prior-claim" : null,
          claimedAt: status === ROTATION_ITEM_STATUSES.failed ? toUnixMillis(Date.now()) : null,
          completedAt,
          attempts: status === ROTATION_ITEM_STATUSES.failed ? 3 : 1,
        });
        return itemId;
      };

      const completedIds = [
        await seedItem(ROTATION_ITEM_STATUSES.completed, toUnixMillis(Date.now())),
        await seedItem(ROTATION_ITEM_STATUSES.completed, toUnixMillis(Date.now())),
      ];
      const failedIds = [
        await seedItem(ROTATION_ITEM_STATUSES.failed, null),
        await seedItem(ROTATION_ITEM_STATUSES.failed, null),
        await seedItem(ROTATION_ITEM_STATUSES.failed, null),
      ];

      const audit = spyAudit();
      const result = await retryRotation(asDb(db), systemId, bucketId, rotationId, auth, audit);

      // Rotation transitioned failed → migrating, failedItems counter reset.
      expect(result.state).toBe(ROTATION_STATES.migrating);
      expect(result.failedItems).toBe(0);

      // Exactly the 3 failed items were reset to pending with claim cleared.
      const failedRowsAfter = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.rotationId, rotationId));
      const byId = new Map(failedRowsAfter.map((row) => [row.id, row]));
      for (const id of failedIds) {
        const row = byId.get(id);
        expect(row?.status).toBe(ROTATION_ITEM_STATUSES.pending);
        expect(row?.claimedBy).toBeNull();
        expect(row?.claimedAt).toBeNull();
      }
      for (const id of completedIds) {
        const row = byId.get(id);
        expect(row?.status).toBe(ROTATION_ITEM_STATUSES.completed);
      }

      // Audit event records the reset count AND the state transition so it
      // cannot be misread as "N retries issued" against a larger item set.
      expect(audit.calls).toHaveLength(1);
      const entry = audit.calls[0];
      expect(entry?.eventType).toBe("bucket.key_rotation.retried");
      expect(entry?.detail).toBe(
        "Rotation retry: reset 3 failed items to pending (rotation state failed → migrating)",
      );
      expect(entry?.systemId).toBe(systemId);
    });

    it("is idempotent when zero items are in failed status — audit detail reports 0 reset", async () => {
      // A rotation can legally be in `failed` state with 0 failed items (e.g.
      // after a prior retry that was interrupted before the rotation-state
      // transition committed). Retry should succeed, transition the state,
      // and lock in the zero-count audit phrasing so reviewers can tell this
      // case apart from the usual non-zero reset.
      const bucketId = await insertBucket();
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);

      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.failed,
        initiatedAt: toUnixMillis(Date.now()),
        totalItems: 2,
        completedItems: 2,
        failedItems: 0,
      });

      // Only completed items — nothing to reset.
      await db.insert(bucketRotationItems).values({
        id: brandId<BucketRotationItemId>(`bri_${crypto.randomUUID()}`),
        systemId,
        rotationId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        status: ROTATION_ITEM_STATUSES.completed,
        claimedBy: null,
        claimedAt: null,
        completedAt: toUnixMillis(Date.now()),
        attempts: 1,
      });

      const audit = spyAudit();
      const result = await retryRotation(asDb(db), systemId, bucketId, rotationId, auth, audit);

      expect(result.state).toBe(ROTATION_STATES.migrating);
      expect(result.failedItems).toBe(0);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.detail).toBe(
        "Rotation retry: reset 0 failed items to pending (rotation state failed → migrating)",
      );
    });
  });

  describe("full lifecycle", () => {
    it("initiate -> claim all -> complete all -> verify completed state", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 5);

      // Step 1: Initiate
      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );
      expect(rotation.state).toBe(ROTATION_STATES.initiated);
      expect(rotation.totalItems).toBe(5);

      // Step 2: Claim first chunk
      const chunk1 = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 3 },
        auth,
      );
      expect(chunk1.data).toHaveLength(3);
      expect(chunk1.rotationState).toBe(ROTATION_STATES.migrating);

      // Step 3: Complete first chunk
      const completion1 = await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        {
          items: chunk1.data.map((item) => ({
            itemId: item.id,
            status: "completed" as const,
          })),
        },
        auth,
        noopAudit,
      );
      expect(completion1.rotation.completedItems).toBe(3);
      expect(completion1.rotation.state).toBe(ROTATION_STATES.migrating);
      expect(completion1.transitioned).toBe(false);

      // Step 4: Claim remaining chunk
      const chunk2 = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );
      expect(chunk2.data).toHaveLength(2);

      // Step 5: Complete remaining chunk
      const completion2 = await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        {
          items: chunk2.data.map((item) => ({
            itemId: item.id,
            status: "completed" as const,
          })),
        },
        auth,
        noopAudit,
      );
      expect(completion2.rotation.completedItems).toBe(5);
      expect(completion2.rotation.failedItems).toBe(0);
      expect(completion2.rotation.state).toBe(ROTATION_STATES.completed);
      expect(completion2.rotation.completedAt).not.toBeNull();
      expect(completion2.transitioned).toBe(true);

      // Step 6: Verify via getRotationProgress
      const final = await getRotationProgress(asDb(db), systemId, bucketId, rotation.id, auth);
      expect(final.state).toBe(ROTATION_STATES.completed);
      expect(final.completedItems).toBe(5);
      expect(final.totalItems).toBe(5);
    });

    it("marks rotation as failed when items exhaust max attempts", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 1);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      // Repeatedly claim and fail the single item until max attempts exhausted
      // maxItemAttempts = 3, so we need 3 failure rounds
      for (let attempt = 0; attempt < 3; attempt++) {
        const claim = await claimRotationChunk(
          asDb(db),
          systemId,
          bucketId,
          rotation.id,
          { chunkSize: 10 },
          auth,
        );

        if (claim.data.length === 0) break;

        await completeRotationChunk(
          asDb(db),
          systemId,
          bucketId,
          rotation.id,
          {
            items: claim.data.map((item) => ({
              itemId: item.id,
              status: "failed" as const,
            })),
          },
          auth,
          noopAudit,
        );
      }

      const final = await getRotationProgress(asDb(db), systemId, bucketId, rotation.id, auth);
      expect(final.state).toBe(ROTATION_STATES.failed);
      expect(final.failedItems).toBe(1);
    });
  });
});
