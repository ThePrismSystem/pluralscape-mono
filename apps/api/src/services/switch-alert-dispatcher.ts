import {
  bucketContentTags,
  deviceTokens,
  friendBucketAssignments,
  friendConnections,
  friendNotificationPreferences,
  notificationConfigs,
} from "@pluralscape/db/pg";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import type { JobQueue } from "@pluralscape/queue";
import type {
  CustomFrontId,
  DeviceTokenId,
  FriendNotificationEventType,
  FrontingSessionId,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** The event type we check for switch alerts. */
const SWITCH_ALERT_EVENT: FriendNotificationEventType = "friend-switch-alert";

/**
 * Dispatch switch alert notifications to all eligible friends after a fronting
 * session is created. Enqueues one `notification-send` job per active device
 * token on each eligible friend account.
 *
 * This function is fire-and-forget — errors are logged, never thrown.
 */
export async function dispatchSwitchAlertForSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  memberId: MemberId | null,
  customFrontId: CustomFrontId | null,
  queue: JobQueue,
): Promise<void> {
  // 1. Check system-level config: is friend-switch-alert enabled?
  const [config] = await db
    .select({
      enabled: notificationConfigs.enabled,
      pushEnabled: notificationConfigs.pushEnabled,
    })
    .from(notificationConfigs)
    .where(
      and(
        eq(notificationConfigs.systemId, systemId),
        eq(notificationConfigs.eventType, SWITCH_ALERT_EVENT),
        eq(notificationConfigs.archived, false),
      ),
    )
    .limit(1);

  if (!config?.enabled || !config.pushEnabled) {
    return;
  }

  // 2. Find all accepted, non-archived friend connections for this system's account
  //    that have friend-switch-alert in their enabledEventTypes
  const accountId = await getSystemAccountId(db, systemId);
  if (!accountId) return;

  const eligibleFriends = await db
    .select({
      connectionId: friendConnections.id,
      friendAccountId: friendConnections.friendAccountId,
    })
    .from(friendConnections)
    .innerJoin(
      friendNotificationPreferences,
      and(
        eq(friendNotificationPreferences.friendConnectionId, friendConnections.id),
        eq(friendNotificationPreferences.accountId, friendConnections.accountId),
        eq(friendNotificationPreferences.archived, false),
      ),
    )
    .where(
      and(
        eq(friendConnections.accountId, accountId),
        eq(friendConnections.status, "accepted"),
        eq(friendConnections.archived, false),
      ),
    );

  // For each friend, check:
  // a) Their preference includes friend-switch-alert (we need to query it separately due to JSONB)
  // b) The member/customFront is visible in their assigned buckets
  // c) They have active device tokens
  for (const friend of eligibleFriends) {
    try {
      // Check preference has friend-switch-alert enabled
      const [pref] = await db
        .select({ enabledEventTypes: friendNotificationPreferences.enabledEventTypes })
        .from(friendNotificationPreferences)
        .where(
          and(
            eq(friendNotificationPreferences.friendConnectionId, friend.connectionId),
            eq(friendNotificationPreferences.accountId, accountId),
            eq(friendNotificationPreferences.archived, false),
          ),
        )
        .limit(1);

      if (!pref) continue;
      const enabledTypes = pref.enabledEventTypes as readonly string[];
      if (!enabledTypes.includes(SWITCH_ALERT_EVENT)) continue;

      // Check bucket visibility: is the fronting entity in a bucket assigned to this friend?
      const entityId = memberId ?? customFrontId;
      const entityType = memberId ? "member" : customFrontId ? "custom-front" : null;
      if (!entityId || !entityType) continue;

      const friendBucketIds = await db
        .select({ bucketId: friendBucketAssignments.bucketId })
        .from(friendBucketAssignments)
        .where(
          and(
            eq(friendBucketAssignments.friendConnectionId, friend.connectionId),
            eq(friendBucketAssignments.systemId, systemId),
          ),
        );

      if (friendBucketIds.length === 0) continue;

      const bucketIds = friendBucketIds.map((r) => r.bucketId);
      const [visibleTag] = await db
        .select({ bucketId: bucketContentTags.bucketId })
        .from(bucketContentTags)
        .where(
          and(
            eq(bucketContentTags.entityType, entityType),
            eq(bucketContentTags.entityId, entityId),
            inArray(bucketContentTags.bucketId, bucketIds),
          ),
        )
        .limit(1);

      if (!visibleTag) continue;

      // Find active device tokens for the friend's account
      const tokens = await db
        .select({
          id: deviceTokens.id,
          platform: deviceTokens.platform,
        })
        .from(deviceTokens)
        .where(
          and(eq(deviceTokens.accountId, friend.friendAccountId), isNull(deviceTokens.revokedAt)),
        );

      // Enqueue one job per device token
      for (const token of tokens) {
        await queue.enqueue({
          type: "notification-send",
          systemId,
          payload: {
            systemId,
            deviceTokenId: token.id as DeviceTokenId,
            platform: token.platform,
            payload: {
              title: "Switch Alert",
              body: "A friend has switched fronters",
              data: null,
            },
          },
          idempotencyKey: `switch-alert:${sessionId}:${token.id}`,
        });
      }
    } catch (err: unknown) {
      // Fail-closed: log and skip this friend, don't abort the whole fan-out
      logger.warn("[switch-alert] error processing friend, skipping", {
        connectionId: friend.connectionId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Look up the account_id that owns the given system. */
async function getSystemAccountId(
  db: PostgresJsDatabase,
  systemId: SystemId,
): Promise<string | null> {
  const { systems } = await import("@pluralscape/db/pg");
  const [row] = await db
    .select({ accountId: systems.accountId })
    .from(systems)
    .where(eq(systems.id, systemId))
    .limit(1);
  return row?.accountId ?? null;
}
