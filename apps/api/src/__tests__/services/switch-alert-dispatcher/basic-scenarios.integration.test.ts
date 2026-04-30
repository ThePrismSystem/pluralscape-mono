import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  createPgPrivacyTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearSwitchAlertConfigCache,
  dispatchSwitchAlertForSession,
} from "../../../services/switch-alert-dispatcher.js";
import { asDb, testBlob } from "../../helpers/integration-setup.js";

import { createMockQueue } from "./internal.js";

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

describe("switch-alert-dispatcher basic scenarios (PGlite integration)", () => {
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
    const now = toUnixMillis(Date.now());
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
    await db.update(deviceTokens).set({ revokedAt: toUnixMillis(Date.now()) });

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
      createdAt: toUnixMillis(Date.now()),
      lastActiveAt: toUnixMillis(Date.now()),
      revokedAt: null,
    });

    // First enqueue call fails, second should still succeed
    const { queue, enqueuedJobs } = createMockQueue({ failOnNth: 1 });
    await dispatchSwitchAlertForSession(asDb(db), systemIdA, sessionId, memberId, null, queue);

    expect(enqueuedJobs).toHaveLength(1);
  });
});
