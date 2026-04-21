import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  createPgPrivacyTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { updateNotificationConfig } from "../../services/notification-config.service.js";
import {
  clearSwitchAlertConfigCache,
  dispatchSwitchAlertForSession,
} from "../../services/switch-alert-dispatcher.js";
import { asDb, makeAuth, testBlob } from "../helpers/integration-setup.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { JobQueue } from "@pluralscape/queue";
import type {
  AccountId,
  BucketId,
  CustomFrontId,
  DeviceTokenId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
  FrontingSessionId,
  JobDefinition,
  JobId,
  MemberId,
  NotificationConfigId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const {
  bucketContentTags,
  buckets,
  deviceTokens,
  friendBucketAssignments,
  friendConnections,
  friendNotificationPreferences,
  notificationConfigs,
} = schema;

/** Captured enqueue call shape. */
interface EnqueuedJob {
  readonly type: string;
  readonly payload: unknown;
  readonly idempotencyKey: string;
}

/** Stub that throws — guards against the dispatcher touching surfaces this test doesn't stub. */
function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`JobQueueMock.${method} was called but no stub was provided`);
  };
}

/** Typed mock JobQueue that captures enqueue calls. */
function createMockQueue(options?: { failOnNth?: number }): {
  queue: JobQueue;
  enqueuedJobs: EnqueuedJob[];
} {
  const enqueuedJobs: EnqueuedJob[] = [];
  let callCount = 0;

  const enqueue: JobQueue["enqueue"] = (params) => {
    callCount++;
    if (options?.failOnNth === callCount) {
      return Promise.reject(new Error("mock enqueue failure"));
    }
    enqueuedJobs.push({
      type: params.type,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
    });
    return Promise.resolve({ id: `job_${crypto.randomUUID()}` as JobId } as JobDefinition);
  };

  const queue: JobQueue = {
    enqueue,
    checkIdempotency: notImplemented("checkIdempotency"),
    dequeue: notImplemented("dequeue"),
    acknowledge: notImplemented("acknowledge"),
    fail: notImplemented("fail"),
    retry: notImplemented("retry"),
    cancel: notImplemented("cancel"),
    getJob: notImplemented("getJob"),
    listJobs: notImplemented("listJobs"),
    listDeadLettered: notImplemented("listDeadLettered"),
    heartbeat: notImplemented("heartbeat"),
    findStalledJobs: notImplemented("findStalledJobs"),
    countJobs: notImplemented("countJobs"),
    getRetryPolicy: notImplemented("getRetryPolicy"),
    setRetryPolicy: notImplemented("setRetryPolicy"),
    setEventHooks: notImplemented("setEventHooks"),
  };
  return { queue, enqueuedJobs };
}

describe("switch-alert-dispatcher (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountIdA: AccountId;
  let systemIdA: SystemId;
  let accountIdB: AccountId;
  let systemIdB: SystemId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    // Privacy tables: buckets, bucket_content_tags, friend_connections, friend_bucket_assignments, etc.
    await createPgPrivacyTables(client);
    // Add notification-specific tables (base + privacy tables already created above)
    await pgExec(client, PG_DDL.deviceTokens);
    await pgExec(client, PG_DDL.deviceTokensIndexes);
    await pgExec(client, PG_DDL.notificationConfigs);
    await pgExec(client, PG_DDL.notificationConfigsIndexes);
    await pgExec(client, PG_DDL.friendNotificationPreferences);
    await pgExec(client, PG_DDL.friendNotificationPreferencesIndexes);

    accountIdA = brandId<AccountId>(await pgInsertAccount(db));
    systemIdA = brandId<SystemId>(await pgInsertSystem(db, accountIdA));

    accountIdB = brandId<AccountId>(await pgInsertAccount(db));
    systemIdB = brandId<SystemId>(await pgInsertSystem(db, accountIdB));
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendNotificationPreferences);
    await db.delete(friendBucketAssignments).catch(() => {});
    await db.delete(bucketContentTags).catch(() => {});
    await db.delete(deviceTokens);
    await db.delete(notificationConfigs);
    await db.delete(friendConnections);
    await db.delete(buckets).catch(() => {});
    // Reset per-test config cache so each case starts with a cold lookup.
    clearSwitchAlertConfigCache();
  });

  /**
   * Set up the full eligible scenario:
   * - A→B forward connection (accepted)
   * - B→A reverse connection (accepted) with B's preference (friend-switch-alert enabled)
   * - System A notification config enabled
   * - Bucket with member tagged, assigned to A→B connection
   * - Device token for friend B's account
   */
  async function setupEligibleFriend(options?: {
    skipConfig?: boolean;
    skipPreference?: boolean;
    customFrontId?: CustomFrontId;
  }): Promise<{
    connectionId: FriendConnectionId;
    reverseConnectionId: FriendConnectionId;
    deviceTokenId: DeviceTokenId;
    memberId: MemberId;
    bucketId: BucketId;
  }> {
    const now = Date.now();
    const memberId = brandId<MemberId>(`mem_${crypto.randomUUID()}`);
    const bucketId = brandId<BucketId>(`bkt_${crypto.randomUUID()}`);
    const connectionId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    const reverseConnectionId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    const deviceTokenId = brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`);
    const configId = brandId<NotificationConfigId>(`nc_${crypto.randomUUID()}`);
    const prefId = brandId<FriendNotificationPreferenceId>(`fnp_${crypto.randomUUID()}`);

    // Forward connection: A -> B, accepted
    await db.insert(friendConnections).values({
      id: connectionId,
      accountId: accountIdA,
      friendAccountId: accountIdB,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });

    // Reverse connection: B -> A, accepted
    await db.insert(friendConnections).values({
      id: reverseConnectionId,
      accountId: accountIdB,
      friendAccountId: accountIdA,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });

    // Notification config: system A, friend-switch-alert enabled
    if (!options?.skipConfig) {
      await db.insert(notificationConfigs).values({
        id: configId,
        systemId: systemIdA,
        eventType: "friend-switch-alert",
        enabled: true,
        pushEnabled: true,
        createdAt: now,
        updatedAt: now,
        archived: false,
        archivedAt: null,
      });
    }

    // B's friend notification preference on B's reverse connection
    if (!options?.skipPreference) {
      await db.insert(friendNotificationPreferences).values({
        id: prefId,
        accountId: accountIdB,
        friendConnectionId: reverseConnectionId,
        enabledEventTypes: ["friend-switch-alert"],
        createdAt: now,
        updatedAt: now,
        archived: false,
        archivedAt: null,
      });
    }

    // Bucket with entity tagged
    await db.insert(buckets).values({
      id: bucketId,
      systemId: systemIdA,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });

    const entityId = options?.customFrontId ?? memberId;
    const entityType = options?.customFrontId ? "custom-front" : "member";

    await db.insert(bucketContentTags).values({
      entityType,
      entityId,
      bucketId,
      systemId: systemIdA,
    });

    // Assign bucket to A→B forward connection
    await db.insert(friendBucketAssignments).values({
      friendConnectionId: connectionId,
      bucketId,
      systemId: systemIdA,
    });

    // Device token for friend's account (B)
    await db.insert(deviceTokens).values({
      id: deviceTokenId,
      accountId: accountIdB,
      systemId: systemIdB,
      platform: "ios",
      tokenHash: `hash-${crypto.randomUUID()}`,
      createdAt: now,
      lastActiveAt: now,
      revokedAt: null,
    });

    return { connectionId, reverseConnectionId, deviceTokenId, memberId, bucketId };
  }

  it("enqueues one notification-send job per device token for eligible friend", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0]?.type).toBe("notification-send");
    expect(enqueuedJobs[0]?.idempotencyKey).toContain(`switch-alert:${sessionId}:`);

    // L2: verify accountId is included in the payload for ownership validation
    const jobPayload = enqueuedJobs[0]?.payload as Record<string, unknown>;
    expect(jobPayload).toHaveProperty("accountId", accountIdB);
  });

  it("does not enqueue when notification config is disabled", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    // Disable the config
    await db.update(notificationConfigs).set({ enabled: false });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when pushEnabled is false but enabled is true", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    await db.update(notificationConfigs).set({ pushEnabled: false, enabled: true });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does NOT dispatch when no notification_config row exists (fail-closed)", async () => {
    const { memberId } = await setupEligibleFriend({ skipConfig: true });
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("dispatches when a row exists with enabled=true and pushEnabled=true (explicit opt-in)", async () => {
    // setupEligibleFriend() writes the config with enabled=true & pushEnabled=true;
    // this test makes the explicit-opt-in contract first-class rather than relying
    // on the broader "enqueues one notification-send job..." happy-path assertion.
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  it("enqueues when friend has no preference row (default-enabled via LEFT JOIN)", async () => {
    const { memberId } = await setupEligibleFriend({ skipPreference: true });
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  it("does not enqueue when friend preference disables the event type", async () => {
    const { memberId, reverseConnectionId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    // Clear enabled event types on B's preference
    await db
      .update(friendNotificationPreferences)
      .set({ enabledEventTypes: [] })
      .where(
        and(
          eq(friendNotificationPreferences.friendConnectionId, reverseConnectionId),
          eq(friendNotificationPreferences.accountId, accountIdB),
        ),
      );

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when friend connection is not accepted", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    // Block both connections
    await db.update(friendConnections).set({ status: "blocked" });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when member is not in any of friend's buckets", async () => {
    await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const untaggedMemberId = brandId<MemberId>(`mem_${crypto.randomUUID()}`);

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(
      asDb(db),
      systemIdA,
      sessionId,
      untaggedMemberId,
      null,
      queue,
    );

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when friend has no active device tokens", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    // Revoke the device token
    await db.update(deviceTokens).set({ revokedAt: Date.now() });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("enqueues when customFrontId is provided (custom-front entity type)", async () => {
    const customFrontId = brandId<CustomFrontId>(`cf_${crypto.randomUUID()}`);
    await setupEligibleFriend({ customFrontId });
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, null, customFrontId, queue);

    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0]?.type).toBe("notification-send");
  });

  it("does not enqueue when both memberId and customFrontId are null", async () => {
    await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, null, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue for non-existent system (getSystemAccountId returns null)", async () => {
    const fakeSystemId = brandId<SystemId>(`sys_${crypto.randomUUID()}`);
    const memberId = brandId<MemberId>(`mem_${crypto.randomUUID()}`);
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), fakeSystemId, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("continues enqueuing after one token fails (per-token resilience)", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);

    // Add a second device token for friend B
    await db.insert(deviceTokens).values({
      id: brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`),
      accountId: accountIdB,
      systemId: systemIdB,
      platform: "android",
      tokenHash: `hash-${crypto.randomUUID()}`,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      revokedAt: null,
    });

    // First enqueue call fails, second should still succeed
    const { queue, enqueuedJobs } = createMockQueue({ failOnNth: 1 });
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  it("enqueues one job per device token across multiple eligible friends", async () => {
    // Set up friend B (already have accounts)
    await setupEligibleFriend();

    // Set up friend C
    const accountIdC = brandId<AccountId>(await pgInsertAccount(db));
    const systemIdC = brandId<SystemId>(await pgInsertSystem(db, accountIdC));

    // Clean up and create a manual multi-friend setup
    await db.delete(friendNotificationPreferences);
    await db.delete(friendBucketAssignments).catch(() => {});
    await db.delete(bucketContentTags).catch(() => {});
    await db.delete(deviceTokens);
    await db.delete(notificationConfigs);
    await db.delete(friendConnections);
    await db.delete(buckets).catch(() => {});

    const now = Date.now();
    const sharedMemberId = brandId<MemberId>(`mem_${crypto.randomUUID()}`);
    const bucketId = brandId<BucketId>(`bkt_${crypto.randomUUID()}`);

    // Notification config
    await db.insert(notificationConfigs).values({
      id: brandId<NotificationConfigId>(`nc_${crypto.randomUUID()}`),
      systemId: systemIdA,
      eventType: "friend-switch-alert",
      enabled: true,
      pushEnabled: true,
      createdAt: now,
      updatedAt: now,
      archived: false,
      archivedAt: null,
    });

    // Bucket with member tagged
    await db.insert(buckets).values({
      id: bucketId,
      systemId: systemIdA,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });
    await db.insert(bucketContentTags).values({
      entityType: "member",
      entityId: sharedMemberId,
      bucketId,
      systemId: systemIdA,
    });

    // Friend B: forward + reverse connections, preference, bucket assignment, 2 tokens
    const connAB = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    const connBA = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    await db.insert(friendConnections).values([
      {
        id: connAB,
        accountId: accountIdA,
        friendAccountId: accountIdB,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
        archivedAt: null,
      },
      {
        id: connBA,
        accountId: accountIdB,
        friendAccountId: accountIdA,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
        archivedAt: null,
      },
    ]);
    await db.insert(friendNotificationPreferences).values({
      id: brandId<FriendNotificationPreferenceId>(`fnp_${crypto.randomUUID()}`),
      accountId: accountIdB,
      friendConnectionId: connBA,
      enabledEventTypes: ["friend-switch-alert"],
      createdAt: now,
      updatedAt: now,
      archived: false,
      archivedAt: null,
    });
    await db.insert(friendBucketAssignments).values({
      friendConnectionId: connAB,
      bucketId,
      systemId: systemIdA,
    });
    await db.insert(deviceTokens).values([
      {
        id: brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`),
        accountId: accountIdB,
        systemId: systemIdB,
        platform: "ios",
        tokenHash: `hash-${crypto.randomUUID()}`,
        createdAt: now,
        lastActiveAt: now,
        revokedAt: null,
      },
      {
        id: brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`),
        accountId: accountIdB,
        systemId: systemIdB,
        platform: "android",
        tokenHash: `hash-${crypto.randomUUID()}`,
        createdAt: now,
        lastActiveAt: now,
        revokedAt: null,
      },
    ]);

    // Friend C: forward + reverse connections, preference, bucket assignment, 1 token
    const connAC = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    const connCA = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
    await db.insert(friendConnections).values([
      {
        id: connAC,
        accountId: accountIdA,
        friendAccountId: accountIdC,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
        archivedAt: null,
      },
      {
        id: connCA,
        accountId: accountIdC,
        friendAccountId: accountIdA,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        version: 1,
        archived: false,
        archivedAt: null,
      },
    ]);
    await db.insert(friendNotificationPreferences).values({
      id: brandId<FriendNotificationPreferenceId>(`fnp_${crypto.randomUUID()}`),
      accountId: accountIdC,
      friendConnectionId: connCA,
      enabledEventTypes: ["friend-switch-alert"],
      createdAt: now,
      updatedAt: now,
      archived: false,
      archivedAt: null,
    });
    await db.insert(friendBucketAssignments).values({
      friendConnectionId: connAC,
      bucketId,
      systemId: systemIdA,
    });
    await db.insert(deviceTokens).values({
      id: brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`),
      accountId: accountIdC,
      systemId: systemIdC,
      platform: "web",
      tokenHash: `hash-${crypto.randomUUID()}`,
      createdAt: now,
      lastActiveAt: now,
      revokedAt: null,
    });

    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(
      asDb(db),
      systemIdA,
      sessionId,
      sharedMemberId,
      null,
      queue,
    );

    // B has 2 tokens, C has 1 token = 3 total
    expect(enqueuedJobs).toHaveLength(3);
    expect(enqueuedJobs.every((j) => j.type === "notification-send")).toBe(true);
  });

  // api-uo21: subsequent dispatches within the TTL must not re-read the
  // notificationConfigs row. We delete the row after the first dispatch;
  // if the cache is working the second dispatch still sees enabled=true
  // and proceeds. (When the cache is absent this scenario fails closed.)
  it("caches the notificationConfigs lookup across dispatches within TTL", async () => {
    const { queue, enqueuedJobs } = createMockQueue();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { memberId } = await setupEligibleFriend();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);
    expect(enqueuedJobs).toHaveLength(1);

    // Wipe the config row; cached value keeps the next dispatch alive.
    await db.delete(notificationConfigs);

    const sessionId2 = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId2, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(2);
  });

  // api-uo21: cache invalidation path — a fresh call after clearing the
  // cache reads the (now-deleted) row and fails closed. Without the
  // invalidation hook in updateNotificationConfig, operator-initiated
  // disables could linger for up to TTL.
  it("fails closed when the config is deleted AND the cache is cleared", async () => {
    const { queue, enqueuedJobs } = createMockQueue();
    const sessionId = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { memberId } = await setupEligibleFriend();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);
    expect(enqueuedJobs).toHaveLength(1);

    await db.delete(notificationConfigs);
    clearSwitchAlertConfigCache();

    const sessionId2 = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId2, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  // End-to-end wire test: calling updateNotificationConfig through the real
  // service path must invalidate the dispatcher's cache so the next dispatch
  // observes the new value immediately — not after TTL expiry. Validates the
  // mutation → invalidation wire together with the hoisted-after-commit fix.
  it("invalidates dispatcher cache when updateNotificationConfig disables the row", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId1 = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    const { queue, enqueuedJobs } = createMockQueue();

    // Warm the cache with enabled=true
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId1, memberId, null, queue);
    expect(enqueuedJobs).toHaveLength(1);

    // Disable via the service layer — must invalidate the dispatcher cache.
    const auth = makeAuth(accountIdA, systemIdA);
    const noopAudit: AuditWriter = () => Promise.resolve();
    await updateNotificationConfig(
      asDb(db),
      systemIdA,
      "friend-switch-alert",
      { enabled: false },
      auth,
      noopAudit,
    );

    const sessionId2 = brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId2, memberId, null, queue);

    // Must still be 1 — no new enqueue because the cache was invalidated and
    // the dispatcher re-read the disabled row.
    expect(enqueuedJobs).toHaveLength(1);
  });
});
