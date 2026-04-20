import {
  bucketContentTags,
  deviceTokens,
  friendBucketAssignments,
  friendConnections,
  friendNotificationPreferences,
  notificationConfigs,
  systems,
} from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { NOTIFICATION_CONFIGS_CACHE_TTL_MS } from "../lib/cache.constants.js";
import { logger } from "../lib/logger.js";
import { QueryCache } from "../lib/query-cache.js";

import type { JobQueue } from "@pluralscape/queue";
import type {
  AccountId,
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

/** Maximum number of enqueue operations executed concurrently per dispatch. */
export const ENQUEUE_CONCURRENCY = 10;

/**
 * Cached shape of the per-system switch-alert config. `null` means an
 * explicit "no row exists / fail-closed" — the dispatcher treats both
 * an absent row and a disabled row as a short-circuit.
 */
interface CachedNotificationConfig {
  readonly enabled: boolean;
  readonly pushEnabled: boolean;
}

/**
 * Per-(systemId, eventType) cache for the notification config row that
 * gates every switch-alert dispatch. Matches the webhook-dispatcher
 * pattern: short TTL + explicit invalidation from mutation paths.
 */
const notificationConfigCache = new QueryCache<CachedNotificationConfig | null>(
  NOTIFICATION_CONFIGS_CACHE_TTL_MS,
);

/** Invalidation key derived from the tenant + event-type tuple. */
function cacheKey(systemId: SystemId, eventType: FriendNotificationEventType): string {
  return `${systemId}:${eventType}`;
}

/**
 * Invalidate the cached switch-alert config for a system.
 *
 * Call from any mutation path that changes `notificationConfigs` rows so
 * operator toggles take effect within a single dispatch rather than
 * lingering for up to the TTL window. Only caches keyed by
 * `FriendNotificationEventType` live in this map; passing an unrelated
 * event type would miss harmlessly but the narrowed signature rules it out
 * at the type system.
 */
export function invalidateSwitchAlertConfigCache(
  systemId: SystemId,
  eventType: FriendNotificationEventType,
): void {
  notificationConfigCache.invalidate(cacheKey(systemId, eventType));
}

/** Clear the entire cache (for test teardown). */
export function clearSwitchAlertConfigCache(): void {
  notificationConfigCache.clear();
}

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
  try {
    // 1. Check system-level config: is friend-switch-alert enabled?
    // Fail-closed: missing config row = DO NOT dispatch. Explicit opt-in required
    // via `notificationConfigs.enabled && pushEnabled` set true.
    //
    // Cache at (systemId, eventType): fronting churn triggers the dispatcher
    // on the hot path for every session. The cached value is the minimal
    // pair of booleans actually consulted by the guard; invalidation fires
    // from notification-config.service mutations.
    const key = cacheKey(systemId, SWITCH_ALERT_EVENT);
    let config: CachedNotificationConfig | null | undefined = notificationConfigCache.get(key);
    if (config === undefined) {
      const [row] = await db
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
      config = row ? { enabled: row.enabled, pushEnabled: row.pushEnabled } : null;
      notificationConfigCache.set(key, config);
    }

    if (!config || !config.enabled || !config.pushEnabled) {
      return;
    }

    // 2. Determine which entity is fronting (member or custom-front)
    const entityId = memberId ?? customFrontId;
    const entityType = memberId ? "member" : customFrontId ? "custom-front" : null;
    if (!entityId || !entityType) return;

    // 3. Find the system owner's account
    const accountId = await getSystemAccountId(db, systemId);
    if (!accountId) return;

    // 4. Find all accepted, non-archived friend connections for this system's account
    const friendConnectionRows = await db
      .select({
        connectionId: friendConnections.id,
        friendAccountId: friendConnections.friendAccountId,
      })
      .from(friendConnections)
      .where(
        and(
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.status, "accepted"),
          eq(friendConnections.archived, false),
        ),
      );

    if (friendConnectionRows.length === 0) return;

    // 5. Find reverse connections (friend -> system owner) with LEFT JOIN on preferences.
    //    Preferences are owned by the friend's account on the friend's connection row.
    //    LEFT JOIN: null enabledEventTypes = no preference row = use defaults (enabled).
    const friendAccountIds = friendConnectionRows.map((r) => r.friendAccountId);

    const reverseConnectionsWithPrefs = await db
      .select({
        friendAccountId: friendConnections.accountId,
        enabledEventTypes: friendNotificationPreferences.enabledEventTypes,
      })
      .from(friendConnections)
      .leftJoin(
        friendNotificationPreferences,
        and(
          eq(friendNotificationPreferences.friendConnectionId, friendConnections.id),
          eq(friendNotificationPreferences.accountId, friendConnections.accountId),
          eq(friendNotificationPreferences.archived, false),
        ),
      )
      .where(
        and(
          inArray(friendConnections.accountId, friendAccountIds),
          eq(friendConnections.friendAccountId, accountId),
          eq(friendConnections.status, "accepted"),
          eq(friendConnections.archived, false),
        ),
      );

    // Build set of eligible friend account IDs based on preference check
    const eligibleFriendAccountIds = new Set<string>();
    for (const row of reverseConnectionsWithPrefs) {
      const types = row.enabledEventTypes as readonly string[] | null;
      // null = no preference row = defaults (enabled)
      if (types === null || types.includes(SWITCH_ALERT_EVENT)) {
        eligibleFriendAccountIds.add(row.friendAccountId);
      }
    }

    if (eligibleFriendAccountIds.size === 0) return;

    // 6. Build map from friendAccountId -> A's connectionId (for bucket assignments)
    const friendToConnectionId = new Map<string, string>();
    for (const row of friendConnectionRows) {
      if (eligibleFriendAccountIds.has(row.friendAccountId)) {
        friendToConnectionId.set(row.friendAccountId, row.connectionId);
      }
    }

    const connectionIds = [...friendToConnectionId.values()];

    // 7. Batch: get all bucket assignments for eligible connections
    const allBucketAssignments = await db
      .select({
        friendConnectionId: friendBucketAssignments.friendConnectionId,
        bucketId: friendBucketAssignments.bucketId,
      })
      .from(friendBucketAssignments)
      .where(
        and(
          inArray(friendBucketAssignments.friendConnectionId, connectionIds),
          eq(friendBucketAssignments.systemId, systemId),
        ),
      );

    if (allBucketAssignments.length === 0) return;

    // Build connectionId -> bucketId[] map
    const connectionBuckets = new Map<string, string[]>();
    for (const row of allBucketAssignments) {
      const existing = connectionBuckets.get(row.friendConnectionId) ?? [];
      existing.push(row.bucketId);
      connectionBuckets.set(row.friendConnectionId, existing);
    }

    // 8. Batch: check entity visibility across all buckets at once
    const allBucketIds = [...new Set(allBucketAssignments.map((r) => r.bucketId))];

    const visibleBuckets = await db
      .select({ bucketId: bucketContentTags.bucketId })
      .from(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.entityType, entityType),
          eq(bucketContentTags.entityId, entityId),
          inArray(bucketContentTags.bucketId, allBucketIds),
        ),
      );

    const visibleBucketSet = new Set(visibleBuckets.map((r) => r.bucketId));

    // Filter to friends whose buckets include the entity
    const friendsWithVisibility = [...friendToConnectionId.entries()]
      .filter(([, connId]) => {
        const bucketIds = connectionBuckets.get(connId) ?? [];
        return bucketIds.some((b) => visibleBucketSet.has(b));
      })
      .map(([friendAcctId]) => friendAcctId);

    if (friendsWithVisibility.length === 0) return;

    // 9. Batch: get all active device tokens for eligible friends
    const allTokens = await db
      .select({
        id: deviceTokens.id,
        accountId: deviceTokens.accountId,
        platform: deviceTokens.platform,
      })
      .from(deviceTokens)
      .where(
        and(inArray(deviceTokens.accountId, friendsWithVisibility), isNull(deviceTokens.revokedAt)),
      );

    // 10. Enqueue one job per device token with bounded concurrency
    for (let i = 0; i < allTokens.length; i += ENQUEUE_CONCURRENCY) {
      const batch = allTokens.slice(i, i + ENQUEUE_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((token) =>
          queue.enqueue({
            type: "notification-send",
            systemId,
            payload: {
              accountId: brandId<AccountId>(token.accountId),
              systemId,
              deviceTokenId: brandId<DeviceTokenId>(token.id),
              platform: token.platform,
              payload: {
                title: "Switch Alert",
                body: "A friend has switched fronters",
                data: null,
              },
            },
            idempotencyKey: `switch-alert:${sessionId}:${token.id}`,
          }),
        ),
      );

      for (const [idx, result] of results.entries()) {
        if (result.status === "rejected") {
          const token = batch[idx];
          logger.warn("[switch-alert] error enqueuing for token, skipping", {
            deviceTokenId: token?.id,
            err: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          });
        }
      }
    }
  } catch (err: unknown) {
    logger.error("[switch-alert] top-level error, aborting dispatch", {
      systemId,
      sessionId,
      err: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

/** Look up the account_id that owns the given system. */
async function getSystemAccountId(
  db: PostgresJsDatabase,
  systemId: SystemId,
): Promise<AccountId | null> {
  const [row] = await db
    .select({ accountId: systems.accountId })
    .from(systems)
    .where(eq(systems.id, systemId))
    .limit(1);
  return row?.accountId ? brandId<AccountId>(row.accountId) : null;
}
