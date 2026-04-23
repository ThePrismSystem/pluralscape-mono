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
import { systemStructureEntityAssociations } from "../schema/pg/structure.js";
import { webhookDeliveries } from "../schema/pg/webhooks.js";

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
  StructureEntityAssociationRow,
  UnconfirmedAcknowledgement,
} from "./types.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

type PgDb = PgDatabase<PgQueryResultHKT>;

/** Get currently fronting members (end_time IS NULL). */
export async function getCurrentFronters(db: PgDb, systemId: SystemId): Promise<CurrentFronter[]> {
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
  systemId: SystemId,
): Promise<CurrentFronterWithDuration[]> {
  return db
    .select({
      id: frontingSessions.id,
      systemId: frontingSessions.systemId,
      startTime: frontingSessions.startTime,
      durationMs: sql<number>`(EXTRACT(EPOCH FROM (NOW() - ${frontingSessions.startTime})) * 1000)::bigint`,
    })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.systemId, systemId), isNull(frontingSessions.endTime)));
}

/** Get active (non-revoked) API keys. */
export async function getActiveApiKeys(db: PgDb, accountId: AccountId): Promise<ActiveApiKey[]> {
  return db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      systemId: apiKeys.systemId,
      keyType: apiKeys.keyType,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)));
}

/** Get pending friend requests (received by this account). */
export async function getPendingFriendRequests(
  db: PgDb,
  accountId: string,
): Promise<PendingFriendRequest[]> {
  return db
    .select({
      id: friendConnections.id,
      accountId: friendConnections.accountId,
      friendAccountId: friendConnections.friendAccountId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(
      and(
        eq(friendConnections.friendAccountId, accountId),
        eq(friendConnections.status, "pending"),
      ),
    );
}

/** Get webhook deliveries pending retry (status = 'failed', under max attempts, due for retry). */
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
      status: sql<"failed">`${webhookDeliveries.status}`,
      attemptCount: webhookDeliveries.attemptCount,
      nextRetryAt: webhookDeliveries.nextRetryAt,
    })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.systemId, systemId),
        eq(webhookDeliveries.status, "failed"),
        sql`${webhookDeliveries.attemptCount} < ${maxAttempts}`,
        sql`${webhookDeliveries.nextRetryAt} <= NOW()`,
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
  accountId: string,
): Promise<ActiveFriendConnection[]> {
  return db
    .select({
      id: friendConnections.id,
      accountId: friendConnections.accountId,
      friendAccountId: friendConnections.friendAccountId,
      createdAt: friendConnections.createdAt,
    })
    .from(friendConnections)
    .where(
      and(eq(friendConnections.accountId, accountId), eq(friendConnections.status, "accepted")),
    );
}

/** Get active (non-revoked) device tokens. */
export async function getActiveDeviceTokens(
  db: PgDb,
  accountId: AccountId,
): Promise<ActiveDeviceToken[]> {
  return db
    .select({
      id: deviceTokens.id,
      accountId: deviceTokens.accountId,
      systemId: deviceTokens.systemId,
      platform: deviceTokens.platform,
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
      frontingSessionId: frontingComments.frontingSessionId,
      systemId: frontingComments.systemId,
      commentCreatedAt: frontingComments.createdAt,
    })
    .from(frontingComments)
    .innerJoin(
      frontingSessions,
      and(
        eq(frontingComments.frontingSessionId, frontingSessions.id),
        eq(frontingComments.systemId, frontingSessions.systemId),
        eq(frontingComments.sessionStartTime, frontingSessions.startTime),
      ),
    )
    .where(and(eq(frontingComments.systemId, systemId), isNull(frontingSessions.endTime)));
}

/** Get active (pending, non-expired) device transfer requests. */
export async function getActiveDeviceTransfers(
  db: PgDb,
  accountId: AccountId,
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
        sql`${deviceTransferRequests.expiresAt} > NOW()`,
      ),
    );
}

/** Get all structure entity associations for a system. */
export async function getStructureEntityAssociations(
  db: PgDb,
  systemId: string,
): Promise<StructureEntityAssociationRow[]> {
  // Drizzle already returns rows in the shape of `StructureEntityAssociationRow`
  // (camelCase columns, `createdAt` as unix millis via `pgTimestamp`), so no
  // snake_case round-trip through `mapStructureEntityAssociationRow` is needed.
  const rows = await db
    .select({
      id: systemStructureEntityAssociations.id,
      systemId: systemStructureEntityAssociations.systemId,
      sourceEntityId: systemStructureEntityAssociations.sourceEntityId,
      targetEntityId: systemStructureEntityAssociations.targetEntityId,
      createdAt: systemStructureEntityAssociations.createdAt,
    })
    .from(systemStructureEntityAssociations)
    .where(eq(systemStructureEntityAssociations.systemId, systemId));
  return rows;
}
