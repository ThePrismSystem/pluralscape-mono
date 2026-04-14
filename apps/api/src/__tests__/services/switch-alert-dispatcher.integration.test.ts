import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  createPgPrivacyTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { dispatchSwitchAlertForSession } from "../../services/switch-alert-dispatcher.js";
import { asDb, testBlob } from "../helpers/integration-setup.js";

import type { JobQueue } from "@pluralscape/queue";
import type {
  AccountId,
  BucketId,
  CustomFrontId,
  DeviceTokenId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
  FrontingSessionId,
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

/** Minimal mock JobQueue that captures enqueue calls. */
function createMockQueue(options?: { failOnNth?: number }): {
  queue: JobQueue;
  enqueuedJobs: EnqueuedJob[];
} {
  const enqueuedJobs: EnqueuedJob[] = [];
  let callCount = 0;
  const queue = {
    enqueue: (params: { type: string; payload: unknown; idempotencyKey: string }) => {
      callCount++;
      if (options?.failOnNth === callCount) {
        return Promise.reject(new Error("mock enqueue failure"));
      }
      enqueuedJobs.push({
        type: params.type,
        payload: params.payload,
        idempotencyKey: params.idempotencyKey,
      });
      return Promise.resolve({ id: `job_${crypto.randomUUID()}` } as never);
    },
  } as never;
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

    accountIdA = (await pgInsertAccount(db)) as AccountId;
    systemIdA = (await pgInsertSystem(db, accountIdA)) as SystemId;

    accountIdB = (await pgInsertAccount(db)) as AccountId;
    systemIdB = (await pgInsertSystem(db, accountIdB)) as SystemId;
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
    const memberId = `mem_${crypto.randomUUID()}` as MemberId;
    const bucketId = `bkt_${crypto.randomUUID()}` as BucketId;
    const connectionId = `fc_${crypto.randomUUID()}` as FriendConnectionId;
    const reverseConnectionId = `fc_${crypto.randomUUID()}` as FriendConnectionId;
    const deviceTokenId = `dt_${crypto.randomUUID()}` as DeviceTokenId;
    const configId = `nc_${crypto.randomUUID()}` as NotificationConfigId;
    const prefId = `fnp_${crypto.randomUUID()}` as FriendNotificationPreferenceId;

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
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
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
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Disable the config
    await db.update(notificationConfigs).set({ enabled: false });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when pushEnabled is false but enabled is true", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    await db.update(notificationConfigs).set({ pushEnabled: false, enabled: true });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("enqueues when no notification config row exists (default-enabled)", async () => {
    const { memberId } = await setupEligibleFriend({ skipConfig: true });
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  it("enqueues when friend has no preference row (default-enabled via LEFT JOIN)", async () => {
    const { memberId } = await setupEligibleFriend({ skipPreference: true });
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });

  it("does not enqueue when friend preference disables the event type", async () => {
    const { memberId, reverseConnectionId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

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
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Block both connections
    await db.update(friendConnections).set({ status: "blocked" });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when member is not in any of friend's buckets", async () => {
    await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const untaggedMemberId = `mem_${crypto.randomUUID()}` as MemberId;

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
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Revoke the device token
    await db.update(deviceTokens).set({ revokedAt: Date.now() });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("enqueues when customFrontId is provided (custom-front entity type)", async () => {
    const customFrontId = `cf_${crypto.randomUUID()}` as CustomFrontId;
    await setupEligibleFriend({ customFrontId });
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, null, customFrontId, queue);

    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0]?.type).toBe("notification-send");
  });

  it("does not enqueue when both memberId and customFrontId are null", async () => {
    await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, null, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue for non-existent system (getSystemAccountId returns null)", async () => {
    const fakeSystemId = `sys_${crypto.randomUUID()}` as SystemId;
    const memberId = `mem_${crypto.randomUUID()}` as MemberId;
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), fakeSystemId, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("continues enqueuing after one token fails (per-token resilience)", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Add a second device token for friend B
    await db.insert(deviceTokens).values({
      id: `dt_${crypto.randomUUID()}` as DeviceTokenId,
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
    const accountIdC = (await pgInsertAccount(db)) as AccountId;
    const systemIdC = (await pgInsertSystem(db, accountIdC)) as SystemId;

    // Clean up and create a manual multi-friend setup
    await db.delete(friendNotificationPreferences);
    await db.delete(friendBucketAssignments).catch(() => {});
    await db.delete(bucketContentTags).catch(() => {});
    await db.delete(deviceTokens);
    await db.delete(notificationConfigs);
    await db.delete(friendConnections);
    await db.delete(buckets).catch(() => {});

    const now = Date.now();
    const sharedMemberId = `mem_${crypto.randomUUID()}` as MemberId;
    const bucketId = `bkt_${crypto.randomUUID()}` as BucketId;

    // Notification config
    await db.insert(notificationConfigs).values({
      id: `nc_${crypto.randomUUID()}` as NotificationConfigId,
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
    const connAB = `fc_${crypto.randomUUID()}` as FriendConnectionId;
    const connBA = `fc_${crypto.randomUUID()}` as FriendConnectionId;
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
      id: `fnp_${crypto.randomUUID()}` as FriendNotificationPreferenceId,
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
        id: `dt_${crypto.randomUUID()}` as DeviceTokenId,
        accountId: accountIdB,
        systemId: systemIdB,
        platform: "ios",
        tokenHash: `hash-${crypto.randomUUID()}`,
        createdAt: now,
        lastActiveAt: now,
        revokedAt: null,
      },
      {
        id: `dt_${crypto.randomUUID()}` as DeviceTokenId,
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
    const connAC = `fc_${crypto.randomUUID()}` as FriendConnectionId;
    const connCA = `fc_${crypto.randomUUID()}` as FriendConnectionId;
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
      id: `fnp_${crypto.randomUUID()}` as FriendNotificationPreferenceId,
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
      id: `dt_${crypto.randomUUID()}` as DeviceTokenId,
      accountId: accountIdC,
      systemId: systemIdC,
      platform: "web",
      tokenHash: `hash-${crypto.randomUUID()}`,
      createdAt: now,
      lastActiveAt: now,
      revokedAt: null,
    });

    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
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
});
