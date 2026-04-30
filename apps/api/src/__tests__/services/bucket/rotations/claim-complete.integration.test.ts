import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { ROTATION_ITEM_STATUSES, ROTATION_STATES, brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { claimRotationChunk } from "../../../../services/bucket/rotations/claim.js";
import { completeRotationChunk } from "../../../../services/bucket/rotations/complete.js";
import { initiateRotation } from "../../../../services/bucket/rotations/initiate.js";
import {
  assertApiError,
  genRotationId,
  makeAuth,
  noopAudit,
  spyAudit,
  asDb,
} from "../../../helpers/integration-setup.js";
import { insertBucket, insertContentTags, initiateParams } from "./internal.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { AccountId, BucketKeyRotationId, BucketRotationItemId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { bucketContentTags, bucketKeyRotations, bucketRotationItems, buckets, keyGrants } = schema;

describe("bucket/rotations — claimRotationChunk / completeRotationChunk (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);
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

  describe("claimRotationChunk", () => {
    it("returns pending items and transitions to migrating", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 3);

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 10 }, auth);

      expect(claim.data).toHaveLength(3);
      expect(claim.rotationState).toBe(ROTATION_STATES.migrating);
      for (const item of claim.data) {
        expect(item.status).toBe(ROTATION_ITEM_STATUSES.claimed);
        expect(item.claimedBy).toBe(auth.authMethod === "session" ? auth.sessionId : null);
      }
    });

    it("returns empty items when nothing is pending", async () => {
      const bucketId = await insertBucket(db, systemId);
      // No content tags — rotation has 0 items

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 10 }, auth);

      expect(claim.data).toHaveLength(0);
    });

    it("respects chunkSize limit", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 5);

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);

      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 2 }, auth);

      expect(claim.data).toHaveLength(2);
    });

    it("throws NOT_FOUND for a non-existent rotation", async () => {
      const bucketId = await insertBucket(db, systemId);
      const fakeRotationId = genRotationId();

      await assertApiError(
        claimRotationChunk(asDb(db), systemId, bucketId, fakeRotationId, { chunkSize: 10 }, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONFLICT when rotation is completed", async () => {
      const bucketId = await insertBucket(db, systemId);

      // Insert a completed rotation directly
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.completed,
        initiatedAt: toUnixMillis(Date.now()),
        completedAt: toUnixMillis(Date.now()),
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

  describe("completeRotationChunk", () => {
    it("marks items as completed and updates counters", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 2);

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);
      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 10 }, auth);

      const completionResult = await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { items: claim.data.map((item) => ({ itemId: item.id, status: "completed" as const })) },
        auth,
        noopAudit,
      );

      expect(completionResult.rotation.completedItems).toBe(2);
      expect(completionResult.rotation.failedItems).toBe(0);
      expect(completionResult.transitioned).toBe(true);
      expect(completionResult.rotation.state).toBe(ROTATION_STATES.completed);
    });

    it("handles failed items and increments attempts", async () => {
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 2);

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);
      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 10 }, auth);

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
        .where(eq(bucketRotationItems.id, brandId<BucketRotationItemId>((claim.data[1] as { id: string }).id)));
      expect(items[0]?.status).toBe(ROTATION_ITEM_STATUSES.pending);
      expect(items[0]?.attempts).toBe(1);
    });

    it("throws NOT_FOUND for a non-existent rotation", async () => {
      const bucketId = await insertBucket(db, systemId);
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
      const bucketId = await insertBucket(db, systemId);

      // Insert a rotation in initiated state (not migrating)
      const rotationId = brandId<BucketKeyRotationId>(`bkr_${crypto.randomUUID()}`);
      await db.insert(bucketKeyRotations).values({
        id: rotationId,
        bucketId,
        systemId,
        fromKeyVersion: 1,
        toKeyVersion: 2,
        state: ROTATION_STATES.initiated,
        initiatedAt: toUnixMillis(Date.now()),
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
      const bucketId = await insertBucket(db, systemId);
      await insertContentTags(db, systemId, bucketId, 1);

      const rotation = await initiateRotation(asDb(db), systemId, bucketId, initiateParams(), auth, noopAudit);
      const claim = await claimRotationChunk(asDb(db), systemId, bucketId, rotation.id, { chunkSize: 10 }, auth);

      const audit = spyAudit();
      await completeRotationChunk(
        asDb(db),
        systemId,
        bucketId,
        rotation.id,
        { items: claim.data.map((item) => ({ itemId: item.id, status: "completed" as const })) },
        auth,
        audit,
      );

      // Should have chunk_completed + completed transition audit entries
      const eventTypes = audit.calls.map((c) => c.eventType);
      expect(eventTypes).toContain("bucket.key_rotation.chunk_completed");
      expect(eventTypes).toContain("bucket.key_rotation.completed");
    });
  });
});
