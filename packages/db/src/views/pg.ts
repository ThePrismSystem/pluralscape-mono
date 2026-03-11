/**
 * PostgreSQL query helpers — equivalent to SQLite views but using
 * Drizzle query builders with explicit parameters.
 *
 * PG RLS policies handle tenant isolation at the database level,
 * but these helpers still accept explicit IDs for clarity and testability.
 */

import { and, eq, isNull, sql } from "drizzle-orm";

import { apiKeys } from "../schema/pg/api-keys.js";
import { deviceTransferRequests } from "../schema/pg/auth.js";
import { acknowledgements } from "../schema/pg/communication.js";
import { frontingComments, frontingSessions } from "../schema/pg/fronting.js";
import { groupMemberships } from "../schema/pg/groups.js";
import { deviceTokens } from "../schema/pg/notifications.js";
import { friendConnections } from "../schema/pg/privacy.js";
import {
  sideSystemLayerLinks,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
} from "../schema/pg/structure.js";
import { webhookDeliveries } from "../schema/pg/webhooks.js";

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
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Database handle accepted by all PG query helpers.
 *
 * Typed as PgliteDatabase (used in tests) but structurally compatible with
 * PostgresJsDatabase at runtime since both share the Drizzle PgDatabase API.
 */
type PgDb = PgliteDatabase;

/** Get currently fronting members (end_time IS NULL). */
export async function getCurrentFronters(db: PgDb, systemId: string): Promise<CurrentFronter[]> {
  return db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      startTime: frontingSessions.startTime,
    })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.systemId, systemId), isNull(frontingSessions.endTime)));
}

/** Get currently fronting members with computed duration in milliseconds. */
export async function getCurrentFrontersWithDuration(
  db: PgDb,
  systemId: string,
): Promise<CurrentFronterWithDuration[]> {
  return db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      startTime: frontingSessions.startTime,
      durationMs: sql<number>`GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${frontingSessions.startTime})) * 1000)::int`,
    })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.systemId, systemId), isNull(frontingSessions.endTime)));
}

/** Get active (non-revoked) API keys. */
export async function getActiveApiKeys(db: PgDb, accountId: string): Promise<ActiveApiKey[]> {
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
    .where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)));
}

/** Get pending friend requests. */
export async function getPendingFriendRequests(
  db: PgDb,
  systemId: string,
): Promise<PendingFriendRequest[]> {
  return db
    .select({
      id: friendConnections.id,
      systemId: friendConnections.systemId,
      friendSystemId: friendConnections.friendSystemId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(and(eq(friendConnections.systemId, systemId), eq(friendConnections.status, "pending")));
}

/** Get webhook deliveries pending retry (status = 'failed', under max attempts). */
export async function getPendingWebhookRetries(
  db: PgDb,
  systemId: string,
  maxAttempts: number,
): Promise<PendingWebhookRetry[]> {
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
    );
}

/** Get unconfirmed acknowledgements. */
export async function getUnconfirmedAcknowledgements(
  db: PgDb,
  systemId: string,
): Promise<UnconfirmedAcknowledgement[]> {
  return db
    .select({
      id: acknowledgements.id,
      systemId: acknowledgements.systemId,
      targetMemberId: acknowledgements.targetMemberId,
      createdAt: acknowledgements.createdAt,
    })
    .from(acknowledgements)
    .where(and(eq(acknowledgements.systemId, systemId), eq(acknowledgements.confirmed, false)));
}

/** Get groups with member counts. */
export async function getMemberGroupSummary(
  db: PgDb,
  systemId: string,
): Promise<MemberGroupSummary[]> {
  return db
    .select({
      groupId: groupMemberships.groupId,
      systemId: groupMemberships.systemId,
      memberCount: sql<number>`count(*)::int`,
    })
    .from(groupMemberships)
    .where(eq(groupMemberships.systemId, systemId))
    .groupBy(groupMemberships.groupId, groupMemberships.systemId);
}

/** Get active (accepted) friend connections. */
export async function getActiveFriendConnections(
  db: PgDb,
  systemId: string,
): Promise<ActiveFriendConnection[]> {
  return db
    .select({
      id: friendConnections.id,
      systemId: friendConnections.systemId,
      friendSystemId: friendConnections.friendSystemId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(and(eq(friendConnections.systemId, systemId), eq(friendConnections.status, "accepted")));
}

/** Get active (non-revoked) device tokens. */
export async function getActiveDeviceTokens(
  db: PgDb,
  accountId: string,
): Promise<ActiveDeviceToken[]> {
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
    .where(and(eq(deviceTokens.accountId, accountId), isNull(deviceTokens.revokedAt)));
}

/** Get fronting comments on currently active sessions (end_time IS NULL). */
export async function getCurrentFrontingComments(
  db: PgDb,
  systemId: string,
): Promise<CurrentFrontingComment[]> {
  return db
    .select({
      commentId: frontingComments.id,
      sessionId: frontingComments.sessionId,
      systemId: frontingComments.systemId,
      commentCreatedAt: frontingComments.createdAt,
    })
    .from(frontingComments)
    .innerJoin(frontingSessions, eq(frontingComments.sessionId, frontingSessions.id))
    .where(and(eq(frontingComments.systemId, systemId), isNull(frontingSessions.endTime)));
}

/** Get active (pending, non-expired) device transfer requests. */
export async function getActiveDeviceTransfers(
  db: PgDb,
  accountId: string,
): Promise<ActiveDeviceTransfer[]> {
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
        sql`${deviceTransferRequests.expiresAt} > ${sql`now()`}`,
      ),
    );
}

/** Get all structure cross-links (UNION of subsystem-layer, subsystem-side-system, side-system-layer). */
export async function getStructureCrossLinks(
  db: PgDb,
  systemId: string,
): Promise<StructureCrossLink[]> {
  const rows = await db.execute<{
    id: string;
    system_id: string;
    link_type: string;
    source_id: string;
    target_id: string;
    created_at: string;
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
  return rows.rows.map((r) =>
    mapStructureCrossLinkRow({
      ...r,
      created_at: Date.parse(r.created_at),
    }),
  );
}
