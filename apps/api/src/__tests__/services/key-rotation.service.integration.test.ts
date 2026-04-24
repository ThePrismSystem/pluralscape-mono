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
import { ROTATION_ITEM_STATUSES, ROTATION_STATES, brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { claimRotationChunk } from "../../services/bucket/rotations/claim.js";
import { completeRotationChunk } from "../../services/bucket/rotations/complete.js";
import { initiateRotation } from "../../services/bucket/rotations/initiate.js";
import { getRotationProgress } from "../../services/bucket/rotations/queries.js";
import { retryRotation } from "../../services/bucket/rotations/retry.js";
import {
  assertApiError,
  genBucketId,
  genRotationId,
  makeAuth,
  noopAudit,
  spyAudit,
  asDb,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  BucketKeyRotationId,
  BucketRotationItemId,
  KeyGrantId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags, bucketKeyRotations, bucketRotationItems, keyGrants } = schema;

describe("key-rotation.service (PGlite integration)", () => {
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

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBucket(id?: BucketId): Promise<BucketId> {
    const resolvedId = id ?? genBucketId();
    const ts = Date.now();
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

  // ── initiateRotation ──────────────────────────────────────────────

  describe("initiateRotation", () => {
    it("creates a rotation record with initiated state", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 3);

      const result = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

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
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 2);

      const result = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const items = await db
        .select()
        .from(bucketRotationItems)
        .where(eq(bucketRotationItems.rotationId, result.id));
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.status).toBe(ROTATION_ITEM_STATUSES.pending);
        expect(item.attempts).toBe(0);
      }
    });

    it("revokes existing key grants on initiation", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 1);

      // Insert an existing key grant
      const grantId = brandId<KeyGrantId>(`kg_${crypto.randomUUID()}`);
      await db.insert(keyGrants).values({
        id: grantId,
        bucketId,
        systemId,
        friendAccountId: accountId,
        encryptedKey: Buffer.from("old-key"),
        keyVersion: 1,
        createdAt: Date.now(),
      });

      await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const grants = await db.select().from(keyGrants).where(eq(keyGrants.id, grantId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.revokedAt).not.toBeNull();
    });

    it("writes an audit entry on initiation", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 1);
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
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 1);

      // Insert an active rotation in migrating state
      await db.insert(bucketKeyRotations).values({
        id: brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`),
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.migrating,
        initiatedAt: Date.now(),
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
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 1);

      const oldRotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: oldRotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.initiated,
        initiatedAt: Date.now(),
        totalItems: 1,
        completedItems: 0,
        failedItems: 0,
      });

      const result = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(3),
        auth,
        noopAudit,
      );

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
      const bucketId = await insertBucket();
      // No content tags inserted

      const result = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      expect(result.totalItems).toBe(0);
      expect(result.state).toBe(ROTATION_STATES.initiated);
    });
  });

  // ── claimRotationChunk ────────────────────────────────────────────

  describe("claimRotationChunk", () => {
    it("returns pending items and transitions to migrating", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 3);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );

      expect(claim.data).toHaveLength(3);
      expect(claim.rotationState).toBe(ROTATION_STATES.migrating);
      for (const item of claim.data) {
        expect(item.status).toBe(ROTATION_ITEM_STATUSES.claimed);
        expect(item.claimedBy).toBe(auth.authMethod === "session" ? auth.sessionId : null);
      }
    });

    it("returns empty items when nothing is pending", async () => {
      const bucketId = await insertBucket();
      // No content tags — rotation has 0 items

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );

      expect(claim.data).toHaveLength(0);
    });

    it("respects chunkSize limit", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 5);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 2 },
        auth,
      );

      expect(claim.data).toHaveLength(2);
    });

    it("throws NOT_FOUND for a non-existent rotation", async () => {
      const bucketId = await insertBucket();
      const fakeRotationId = genRotationId();

      await assertApiError(
        claimRotationChunk(asDb(db), systemId, bucketId, fakeRotationId, { chunkSize: 10 }, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONFLICT when rotation is completed", async () => {
      const bucketId = await insertBucket();

      // Insert a completed rotation directly
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.completed,
        initiatedAt: Date.now(),
        completedAt: Date.now(),
        totalItems: 0,
        completedItems: 0,
        failedItems: 0,
      });

      await assertApiError(
        claimRotationChunk(asDb(db), systemId, bucketId, rotationId, { chunkSize: 10 }, auth),
        "CONFLICT",
        409,
      );
    });
  });

  // ── completeRotationChunk ─────────────────────────────────────────

  describe("completeRotationChunk", () => {
    it("marks items as completed and updates counters", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 2);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );

      const completionResult = await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        {
          items: claim.data.map((item) => ({
            itemId: item.id,
            status: "completed",
          })),
        },
        auth,
        noopAudit,
      );

      expect(completionResult.rotation.completedItems).toBe(2);
      expect(completionResult.rotation.failedItems).toBe(0);
      expect(completionResult.transitioned).toBe(true);
      expect(completionResult.rotation.state).toBe(ROTATION_STATES.completed);
    });

    it("handles failed items and increments attempts", async () => {
      const bucketId = await insertBucket();
      await insertContentTags(bucketId, 2);

      const rotation = await initiateRotation(
        asDb(db),
        systemId,
        bucketId,
        initiateParams(),
        auth,
        noopAudit,
      );

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );

      // Complete first item, fail second
      const completionResult = await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        {
          items: [
            { itemId: (claim.data[0] as { id: string }).id, status: "completed" },
            { itemId: (claim.data[1] as { id: string }).id, status: "failed" },
          ],
        },
        auth,
        noopAudit,
      );

      // Failed item with attempts < maxItemAttempts goes back to pending, not permanently failed
      expect(completionResult.rotation.completedItems).toBe(1);
      // The item's attempts were incremented but it isn't permanently failed yet
      // (maxItemAttempts = 3, first failure = attempts 1)
      expect(completionResult.rotation.failedItems).toBe(0);

      // The failed item should be back to pending for retry
      const items = await db
        .select()
        .from(bucketRotationItems)
        .where(
          eq(
            bucketRotationItems.id,
            brandId<BucketRotationItemId>((claim.data[1] as { id: string }).id),
          ),
        );
      expect(items[0]?.status).toBe(ROTATION_ITEM_STATUSES.pending);
      expect(items[0]?.attempts).toBe(1);
    });

    it("throws NOT_FOUND for a non-existent rotation", async () => {
      const bucketId = await insertBucket();
      const fakeRotationId = genRotationId();

      await assertApiError(
        completeRotationChunk(
          asDb(db),
          systemId,
          bucketId,
          fakeRotationId,
          { items: [{ itemId: "bri_fake", status: "completed" }] },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONFLICT when rotation is not in migrating state", async () => {
      const bucketId = await insertBucket();

      // Insert a rotation in initiated state (not migrating)
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.initiated,
        initiatedAt: Date.now(),
        totalItems: 0,
        completedItems: 0,
        failedItems: 0,
      });

      await assertApiError(
        completeRotationChunk(
          asDb(db),
          systemId,
          bucketId,
          rotationId,
          { items: [{ itemId: "bri_fake", status: "completed" }] },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("writes audit entries on chunk completion", async () => {
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

      const claim = await claimRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { chunkSize: 10 },
        auth,
      );

      const audit = spyAudit();
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
        audit,
      );

      // Should have chunk_completed + completed transition audit entries
      const eventTypes = audit.calls.map((c) => c.eventType);
      expect(eventTypes).toContain("bucket.key_rotation.chunk_completed");
      expect(eventTypes).toContain("bucket.key_rotation.completed");
    });
  });

  // ── getRotationProgress ───────────────────────────────────────────

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

  // ── retryRotation ─────────────────────────────────────────────────

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
        initiatedAt: Date.now(),
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
        completedAt: number | null,
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
          claimedAt: status === ROTATION_ITEM_STATUSES.failed ? Date.now() : null,
          completedAt,
          attempts: status === ROTATION_ITEM_STATUSES.failed ? 3 : 1,
        });
        return itemId;
      };

      const completedIds = [
        await seedItem(ROTATION_ITEM_STATUSES.completed, Date.now()),
        await seedItem(ROTATION_ITEM_STATUSES.completed, Date.now()),
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
        initiatedAt: Date.now(),
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
        completedAt: Date.now(),
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

  // ── Full lifecycle ────────────────────────────────────────────────

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
