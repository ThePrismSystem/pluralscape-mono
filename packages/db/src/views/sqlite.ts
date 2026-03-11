/** SQLite query builder functions — explicit parameters for all filters. */

import { and, eq, isNull, sql } from "drizzle-orm";

import { apiKeys } from "../schema/sqlite/api-keys.js";
import { deviceTransferRequests } from "../schema/sqlite/auth.js";
import { acknowledgements } from "../schema/sqlite/communication.js";
import { frontingComments, frontingSessions } from "../schema/sqlite/fronting.js";
import { groupMemberships } from "../schema/sqlite/groups.js";
import { deviceTokens } from "../schema/sqlite/notifications.js";
import { friendConnections } from "../schema/sqlite/privacy.js";
import {
  sideSystemLayerLinks,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
} from "../schema/sqlite/structure.js";
import { webhookDeliveries } from "../schema/sqlite/webhooks.js";

import { mapStructureCrossLinkRow } from "./types.js";

import type {
  ActiveApiKey,
  ActiveDeviceToken,
  ActiveDeviceTransfer,
  ActiveFriendConnection,
  CurrentFronter,
  CurrentFronterWithDuration,
  CurrentFrontingComment,
  MemberGroupSummary,
  PendingFriendRequest,
  PendingWebhookRetry,
  StructureCrossLink,
  UnconfirmedAcknowledgement,
} from "./types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

/** Get currently fronting members (end_time IS NULL). */
export function getCurrentFronters(db: BetterSQLite3Database, systemId: string): CurrentFronter[] {
  return db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      startTime: frontingSessions.startTime,
    })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.systemId, systemId), isNull(frontingSessions.endTime)))
    .all();
}

/**
 * Get currently fronting members with computed duration in milliseconds.
 *
 * Note: SQLite `strftime('%s', ...)` has 1-second precision, so durations
 * are accurate to ~1000ms. Use application-layer `Date.now()` for sub-second precision.
 */
export function getCurrentFrontersWithDuration(
  db: BetterSQLite3Database,
  systemId: string,
): CurrentFronterWithDuration[] {
  return db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      startTime: frontingSessions.startTime,
      durationMs: sql<number>`MAX(0, (strftime('%s', 'now') * 1000) - ${frontingSessions.startTime})`,
    })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.systemId, systemId), isNull(frontingSessions.endTime)))
    .all();
}

/** Get active (non-revoked) API keys. */
export function getActiveApiKeys(db: BetterSQLite3Database, accountId: string): ActiveApiKey[] {
  return db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      systemId: apiKeys.systemId,
      name: apiKeys.name,
      keyType: apiKeys.keyType,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
    .all();
}

/** Get pending friend requests. */
export function getPendingFriendRequests(
  db: BetterSQLite3Database,
  systemId: string,
): PendingFriendRequest[] {
  return db
    .select({
      id: friendConnections.id,
      systemId: friendConnections.systemId,
      friendSystemId: friendConnections.friendSystemId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(and(eq(friendConnections.systemId, systemId), eq(friendConnections.status, "pending")))
    .all();
}

/** Get webhook deliveries pending retry (status = 'failed', under max attempts). */
export function getPendingWebhookRetries(
  db: BetterSQLite3Database,
  systemId: string,
  maxAttempts: number,
): PendingWebhookRetry[] {
  return db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      systemId: webhookDeliveries.systemId,
      eventType: webhookDeliveries.eventType,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      nextRetryAt: webhookDeliveries.nextRetryAt,
    })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.systemId, systemId),
        eq(webhookDeliveries.status, "failed"),
        sql`${webhookDeliveries.attemptCount} < ${maxAttempts}`,
      ),
    )
    .all();
}

/** Get unconfirmed acknowledgements. */
export function getUnconfirmedAcknowledgements(
  db: BetterSQLite3Database,
  systemId: string,
): UnconfirmedAcknowledgement[] {
  return db
    .select({
      id: acknowledgements.id,
      systemId: acknowledgements.systemId,
      targetMemberId: acknowledgements.targetMemberId,
      createdAt: acknowledgements.createdAt,
    })
    .from(acknowledgements)
    .where(and(eq(acknowledgements.systemId, systemId), eq(acknowledgements.confirmed, false)))
    .all();
}

/** Get groups with member counts. */
export function getMemberGroupSummary(
  db: BetterSQLite3Database,
  systemId: string,
): MemberGroupSummary[] {
  return db
    .select({
      groupId: groupMemberships.groupId,
      systemId: groupMemberships.systemId,
      memberCount: sql<number>`count(*)`,
    })
    .from(groupMemberships)
    .where(eq(groupMemberships.systemId, systemId))
    .groupBy(groupMemberships.groupId, groupMemberships.systemId)
    .all();
}

/** Get active (accepted) friend connections. */
export function getActiveFriendConnections(
  db: BetterSQLite3Database,
  systemId: string,
): ActiveFriendConnection[] {
  return db
    .select({
      id: friendConnections.id,
      systemId: friendConnections.systemId,
      friendSystemId: friendConnections.friendSystemId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(and(eq(friendConnections.systemId, systemId), eq(friendConnections.status, "accepted")))
    .all();
}

/** Get active (non-revoked) device tokens. */
export function getActiveDeviceTokens(
  db: BetterSQLite3Database,
  accountId: string,
): ActiveDeviceToken[] {
  return db
    .select({
      id: deviceTokens.id,
      accountId: deviceTokens.accountId,
      systemId: deviceTokens.systemId,
      platform: deviceTokens.platform,
      token: deviceTokens.token,
      createdAt: deviceTokens.createdAt,
    })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.accountId, accountId), isNull(deviceTokens.revokedAt)))
    .all();
}

/** Get fronting comments on currently active sessions (end_time IS NULL). */
export function getCurrentFrontingComments(
  db: BetterSQLite3Database,
  systemId: string,
): CurrentFrontingComment[] {
  return db
    .select({
      commentId: frontingComments.id,
      sessionId: frontingComments.sessionId,
      systemId: frontingComments.systemId,
      commentCreatedAt: frontingComments.createdAt,
    })
    .from(frontingComments)
    .innerJoin(frontingSessions, eq(frontingComments.sessionId, frontingSessions.id))
    .where(and(eq(frontingComments.systemId, systemId), isNull(frontingSessions.endTime)))
    .all();
}

/** Get active (pending, non-expired) device transfer requests. */
export function getActiveDeviceTransfers(
  db: BetterSQLite3Database,
  accountId: string,
): ActiveDeviceTransfer[] {
  const now = Date.now();
  return db
    .select({
      id: deviceTransferRequests.id,
      accountId: deviceTransferRequests.accountId,
      sourceSessionId: deviceTransferRequests.sourceSessionId,
      targetSessionId: deviceTransferRequests.targetSessionId,
      createdAt: deviceTransferRequests.createdAt,
      expiresAt: deviceTransferRequests.expiresAt,
    })
    .from(deviceTransferRequests)
    .where(
      and(
        eq(deviceTransferRequests.accountId, accountId),
        eq(deviceTransferRequests.status, "pending"),
        sql`${deviceTransferRequests.expiresAt} > ${now}`,
      ),
    )
    .all();
}

/** Get all structure cross-links (UNION of subsystem-layer, subsystem-side-system, side-system-layer). */
export function getStructureCrossLinks(
  db: BetterSQLite3Database,
  systemId: string,
): StructureCrossLink[] {
  const rows = db.all<{
    id: string;
    system_id: string;
    link_type: string;
    source_id: string;
    target_id: string;
    created_at: number;
  }>(sql`
    SELECT id, system_id, 'subsystem-layer' as link_type, subsystem_id as source_id, layer_id as target_id, created_at
    FROM ${subsystemLayerLinks}
    WHERE system_id = ${systemId}
    UNION ALL
    SELECT id, system_id, 'subsystem-side-system' as link_type, subsystem_id as source_id, side_system_id as target_id, created_at
    FROM ${subsystemSideSystemLinks}
    WHERE system_id = ${systemId}
    UNION ALL
    SELECT id, system_id, 'side-system-layer' as link_type, side_system_id as source_id, layer_id as target_id, created_at
    FROM ${sideSystemLayerLinks}
    WHERE system_id = ${systemId}
  `);
  return rows.map(mapStructureCrossLinkRow);
}
