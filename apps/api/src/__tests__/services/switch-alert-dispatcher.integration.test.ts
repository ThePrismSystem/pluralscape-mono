import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  createPgPrivacyTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { dispatchSwitchAlertForSession } from "../../services/switch-alert-dispatcher.js";
import { asDb, testBlob } from "../helpers/integration-setup.js";

import type { JobQueue } from "@pluralscape/queue";
import type {
  AccountId,
  BucketId,
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
function createMockQueue(): { queue: JobQueue; enqueuedJobs: EnqueuedJob[] } {
  const enqueuedJobs: EnqueuedJob[] = [];
  const queue: JobQueue = {
    enqueue: (params: { type: string; payload: unknown; idempotencyKey: string }) => {
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

  /** Set up the full eligible scenario: accepted connection, config enabled, preference enabled, bucket visible, device token active. */
  async function setupEligibleFriend(): Promise<{
    connectionId: FriendConnectionId;
    deviceTokenId: DeviceTokenId;
    memberId: MemberId;
    bucketId: BucketId;
  }> {
    const now = Date.now();
    const memberId = `mem_${crypto.randomUUID()}` as MemberId;
    const bucketId = `bkt_${crypto.randomUUID()}` as BucketId;
    const connectionId = `fc_${crypto.randomUUID()}` as FriendConnectionId;
    const deviceTokenId = `dt_${crypto.randomUUID()}` as DeviceTokenId;
    const configId = `nc_${crypto.randomUUID()}` as NotificationConfigId;
    const prefId = `fnp_${crypto.randomUUID()}` as FriendNotificationPreferenceId;

    // Friend connection: A -> B, accepted
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

    // Notification config: system A, friend-switch-alert enabled
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

    // Friend notification preference: friend-switch-alert enabled
    await db.insert(friendNotificationPreferences).values({
      id: prefId,
      accountId: accountIdA,
      friendConnectionId: connectionId,
      enabledEventTypes: ["friend-switch-alert"],
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
      entityId: memberId,
      bucketId,
      systemId: systemIdA,
    });

    // Assign bucket to friend
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
      token: `token-${crypto.randomUUID()}`,
      createdAt: now,
      lastActiveAt: now,
      revokedAt: null,
    });

    return { connectionId, deviceTokenId, memberId, bucketId };
  }

  it("enqueues one notification-send job per device token for eligible friend", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;
    const { queue, enqueuedJobs } = createMockQueue();

    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0]?.type).toBe("notification-send");
    expect(enqueuedJobs[0]?.idempotencyKey).toContain(`switch-alert:${sessionId}:`);
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

  it("does not enqueue when friend preference disables the event type", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Clear enabled event types
    await db.update(friendNotificationPreferences).set({ enabledEventTypes: [] });

    const { queue, enqueuedJobs } = createMockQueue();
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(0);
  });

  it("does not enqueue when friend connection is not accepted", async () => {
    const { memberId } = await setupEligibleFriend();
    const sessionId = `fs_${crypto.randomUUID()}` as FrontingSessionId;

    // Block the connection
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
});
