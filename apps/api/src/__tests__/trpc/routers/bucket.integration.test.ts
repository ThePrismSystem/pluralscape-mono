import { friendConnections } from "@pluralscape/db/pg";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { bucketRouter } from "../../../trpc/routers/bucket.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedAccountAndSystem,
  seedBucket,
  seedFriendConnection,
  seedMember,
  seedSecondTenant,
  setupRouterIntegration,
  truncateAll,
  type RouterIntegrationCtx,
  type SeededTenant,
} from "../integration-helpers.js";
import { makeIntegrationCallerFactory } from "../test-helpers.js";

import type { BucketKeyRotationId, FriendConnectionId } from "@pluralscape/types";

/**
 * Seed an *accepted* friend connection between `a` and `b`.
 *
 * `seedFriendConnection` walks the production code/redeem path which leaves
 * both rows in `pending` status — friend-bucket assignment requires
 * `accepted`. The production path to "accept" requires the *other* tenant's
 * auth to invoke `acceptFriendConnection`; doing that here would couple this
 * test to a separate router. We instead flip the status directly via SQL,
 * which is the same shape `acceptFriendConnection` would produce.
 *
 * Returns the connection id owned by `b` (matches `seedFriendConnection`'s
 * contract).
 */
async function seedAcceptedFriendConnection(
  ctx: RouterIntegrationCtx,
  a: SeededTenant,
  b: SeededTenant,
): Promise<FriendConnectionId> {
  const connectionId = await seedFriendConnection(ctx.db, a, b);
  // Flip both sides to "accepted" — assignBucketToFriend only inspects the
  // owner's row, but the reverse row is updated for consistency with the
  // production accept path.
  await ctx.db
    .update(friendConnections)
    .set({ status: "accepted" })
    .where(eq(friendConnections.accountId, a.accountId));
  await ctx.db
    .update(friendConnections)
    .set({ status: "accepted" })
    .where(eq(friendConnections.accountId, b.accountId));
  return connectionId;
}

/** Initial version returned by createBucket; required input for `update`. */
const INITIAL_BUCKET_VERSION = 1;

/** Key version for the first friend bucket-key grant (>= 1 per AssignBucketBodySchema). */
const INITIAL_KEY_VERSION = 1;

/**
 * Key version used when initiating a rotation. InitiateRotationBodySchema requires
 * `newKeyVersion >= 2` because rotations always advance from an existing v1 key.
 */
const NEW_KEY_VERSION_AFTER_ROTATION = 2;

/** Encrypted-key payload (base64) used for friend assignments and rotation grants. */
const TEST_ENCRYPTED_KEY_BASE64 = Buffer.from("test-encrypted-bucket-key").toString("base64");

/** Default chunk size for claimRotationChunk happy-path tests. */
const TEST_ROTATION_CHUNK_SIZE = 10;

describe("bucket router integration", () => {
  let ctx: RouterIntegrationCtx;
  let makeCaller: ReturnType<typeof makeIntegrationCallerFactory<{ bucket: typeof bucketRouter }>>;
  let primary: SeededTenant;
  let other: SeededTenant;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
    makeCaller = makeIntegrationCallerFactory({ bucket: bucketRouter }, ctx.db);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    primary = await seedAccountAndSystem(ctx.db);
    other = await seedSecondTenant(ctx.db);
  });

  afterEach(async () => {
    await truncateAll(ctx);
  });

  // ── Bucket CRUD happy paths ─────────────────────────────────────────

  describe("bucket.create", () => {
    it("creates a bucket belonging to the caller's system", async () => {
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^bkt_/);
    });
  });

  describe("bucket.get", () => {
    it("returns a bucket by id", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.get({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.id).toBe(bucketId);
    });
  });

  describe("bucket.list", () => {
    it("returns buckets of the caller's system", async () => {
      await seedBucket(ctx.db, primary.systemId, primary.auth);
      await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // listBuckets returns PaginatedResult<BucketResult> ⇒ `data`, not `items`.
      const result = await caller.bucket.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("bucket.update", () => {
    it("updates a bucket's encrypted data", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // UpdateBucketBodySchema requires `version` (optimistic concurrency token).
      // Newly seeded buckets start at version 1.
      const result = await caller.bucket.update({
        systemId: primary.systemId,
        bucketId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_BUCKET_VERSION,
      });
      expect(result.id).toBe(bucketId);
    });
  });

  describe("bucket.archive", () => {
    it("archives a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.archive({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("bucket.restore", () => {
    it("restores an archived bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.bucket.archive({ systemId: primary.systemId, bucketId });
      const restored = await caller.bucket.restore({
        systemId: primary.systemId,
        bucketId,
      });
      expect(restored.id).toBe(bucketId);
    });
  });

  describe("bucket.delete", () => {
    it("deletes a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.delete({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Friend assignments ─────────────────────────────────────────────
  //
  // assignFriend requires a connection where `accountId === primary.accountId`.
  // `seedFriendConnection(db, a, b)` returns the redeemer's (B's) connection,
  // so seed with `(other, primary)` to get primary's owning side.

  describe("bucket.assignFriend", () => {
    it("assigns a bucket to a friend connection", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const connectionId = await seedAcceptedFriendConnection(ctx, other, primary);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.assignFriend({
        systemId: primary.systemId,
        bucketId,
        connectionId,
        encryptedBucketKey: TEST_ENCRYPTED_KEY_BASE64,
        keyVersion: INITIAL_KEY_VERSION,
      });
      expect(result.bucketId).toBe(bucketId);
      expect(result.friendConnectionId).toBe(connectionId);
    });
  });

  describe("bucket.unassignFriend", () => {
    it("revokes a previously assigned friend bucket connection", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const connectionId = await seedAcceptedFriendConnection(ctx, other, primary);
      const caller = makeCaller(primary.auth);
      await caller.bucket.assignFriend({
        systemId: primary.systemId,
        bucketId,
        connectionId,
        encryptedBucketKey: TEST_ENCRYPTED_KEY_BASE64,
        keyVersion: INITIAL_KEY_VERSION,
      });
      const result = await caller.bucket.unassignFriend({
        systemId: primary.systemId,
        bucketId,
        connectionId,
      });
      // UnassignBucketResult is `{ pendingRotation: { systemId, bucketId } }`
      // — the unassign also queues a rotation for the bucket.
      expect(result.pendingRotation.bucketId).toBe(bucketId);
    });
  });

  describe("bucket.listFriendAssignments", () => {
    it("returns assignments for a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const connectionId = await seedAcceptedFriendConnection(ctx, other, primary);
      const caller = makeCaller(primary.auth);
      await caller.bucket.assignFriend({
        systemId: primary.systemId,
        bucketId,
        connectionId,
        encryptedBucketKey: TEST_ENCRYPTED_KEY_BASE64,
        keyVersion: INITIAL_KEY_VERSION,
      });
      const result = await caller.bucket.listFriendAssignments({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.length).toBe(1);
      expect(result[0]?.friendConnectionId).toBe(connectionId);
    });
  });

  // ── Content tags ───────────────────────────────────────────────────

  describe("bucket.tagContent", () => {
    it("tags a member entity into a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.tagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      expect(result.bucketId).toBe(bucketId);
      expect(result.entityType).toBe("member");
      expect(result.entityId).toBe(memberId);
    });
  });

  describe("bucket.untagContent", () => {
    it("removes a content tag from a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.bucket.tagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      const result = await caller.bucket.untagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("bucket.listTags", () => {
    it("returns tags currently attached to a bucket", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.bucket.tagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      const result = await caller.bucket.listTags({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.length).toBe(1);
      expect(result[0]?.entityId).toBe(memberId);
    });
  });

  // ── Export ─────────────────────────────────────────────────────────

  describe("bucket.exportManifest", () => {
    it("returns an export manifest with per-entity-type entries", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.exportManifest({
        systemId: primary.systemId,
        bucketId,
      });
      expect(result.bucketId).toBe(bucketId);
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe("bucket.exportPage", () => {
    it("returns a paginated page for a tagged entity type", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.bucket.tagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      // BucketExportPageResponse exposes a `data` array of encrypted entities
      // plus pagination metadata. The exact shape varies per entity type,
      // so we only assert the cursor/data pair is present.
      const result = await caller.bucket.exportPage({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        limit: TEST_ROTATION_CHUNK_SIZE,
      });
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // ── Key rotation ───────────────────────────────────────────────────
  //
  // initiateRotation works on an empty bucket (no content tags ⇒ no
  // rotation items). The rotation transitions through
  // initiated → migrating once any chunk is claimed.

  describe("bucket.initiateRotation", () => {
    it("initiates a rotation for a bucket with no friend grants", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.bucket.initiateRotation({
        systemId: primary.systemId,
        bucketId,
        wrappedNewKey: TEST_ENCRYPTED_KEY_BASE64,
        newKeyVersion: NEW_KEY_VERSION_AFTER_ROTATION,
        friendKeyGrants: [],
      });
      expect(result.bucketId).toBe(bucketId);
      expect(result.toKeyVersion).toBe(NEW_KEY_VERSION_AFTER_ROTATION);
      expect(result.state).toBe("initiated");
    });
  });

  describe("bucket.rotationProgress", () => {
    it("returns the current rotation state", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const initiated = await caller.bucket.initiateRotation({
        systemId: primary.systemId,
        bucketId,
        wrappedNewKey: TEST_ENCRYPTED_KEY_BASE64,
        newKeyVersion: NEW_KEY_VERSION_AFTER_ROTATION,
        friendKeyGrants: [],
      });
      const rotationId: BucketKeyRotationId = initiated.id;
      const result = await caller.bucket.rotationProgress({
        systemId: primary.systemId,
        bucketId,
        rotationId,
      });
      expect(result.id).toBe(rotationId);
    });
  });

  describe("bucket.claimRotationChunk", () => {
    it("returns an empty data array when no items are pending", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const initiated = await caller.bucket.initiateRotation({
        systemId: primary.systemId,
        bucketId,
        wrappedNewKey: TEST_ENCRYPTED_KEY_BASE64,
        newKeyVersion: NEW_KEY_VERSION_AFTER_ROTATION,
        friendKeyGrants: [],
      });
      const rotationId: BucketKeyRotationId = initiated.id;
      // Empty bucket ⇒ zero rotation items ⇒ ChunkClaimResponse.data = [].
      // State stays "initiated" because the migrating transition only fires
      // when at least one item is actually claimed.
      const result = await caller.bucket.claimRotationChunk({
        systemId: primary.systemId,
        bucketId,
        rotationId,
        chunkSize: TEST_ROTATION_CHUNK_SIZE,
      });
      expect(result.data.length).toBe(0);
      expect(result.rotationState).toBe("initiated");
    });
  });

  describe("bucket.completeRotationChunk", () => {
    // Full happy-path requires the rotation to advance to `migrating`, which
    // only happens after at least one item is claimed. We tag a member into
    // the bucket so initiate creates a single rotation item, then claim it
    // before completing.
    it("marks a claimed item complete and advances the rotation", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.bucket.tagContent({
        systemId: primary.systemId,
        bucketId,
        entityType: "member",
        entityId: memberId,
      });
      const initiated = await caller.bucket.initiateRotation({
        systemId: primary.systemId,
        bucketId,
        wrappedNewKey: TEST_ENCRYPTED_KEY_BASE64,
        newKeyVersion: NEW_KEY_VERSION_AFTER_ROTATION,
        friendKeyGrants: [],
      });
      const rotationId: BucketKeyRotationId = initiated.id;
      const claimed = await caller.bucket.claimRotationChunk({
        systemId: primary.systemId,
        bucketId,
        rotationId,
        chunkSize: TEST_ROTATION_CHUNK_SIZE,
      });
      // The claim must yield exactly the one item we tagged.
      expect(claimed.data.length).toBe(1);
      const claimedItem = claimed.data[0];
      if (!claimedItem) throw new Error("expected claimed rotation item");
      const result = await caller.bucket.completeRotationChunk({
        systemId: primary.systemId,
        bucketId,
        rotationId,
        items: [{ itemId: claimedItem.id, status: "completed" }],
      });
      expect(result.rotation.id).toBe(rotationId);
    });
  });

  describe("bucket.retryRotation", () => {
    // retryRotation only accepts rotations in `failed` state. Driving a
    // rotation to `failed` end-to-end requires multi-step setup that
    // duplicates the key-rotation service tests; here we exercise the
    // procedure wiring + middleware by asserting it rejects an `initiated`
    // rotation with CONFLICT, which is the documented contract.
    it("rejects retry on a rotation that has not failed", async () => {
      const bucketId = await seedBucket(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const initiated = await caller.bucket.initiateRotation({
        systemId: primary.systemId,
        bucketId,
        wrappedNewKey: TEST_ENCRYPTED_KEY_BASE64,
        newKeyVersion: NEW_KEY_VERSION_AFTER_ROTATION,
        friendKeyGrants: [],
      });
      const rotationId: BucketKeyRotationId = initiated.id;
      await expect(
        caller.bucket.retryRotation({
          systemId: primary.systemId,
          bucketId,
          rotationId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const caller = makeCaller(null);
      await expectAuthRequired(caller.bucket.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's bucket", async () => {
      const otherBucketId = await seedBucket(ctx.db, other.systemId, other.auth);
      const caller = makeCaller(primary.auth);
      await expectTenantDenied(
        caller.bucket.get({
          systemId: other.systemId,
          bucketId: otherBucketId,
        }),
      );
    });
  });
});
