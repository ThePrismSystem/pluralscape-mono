import { friendBucketAssignments, friendConnections, keyGrants } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { assertAccountOwnership } from "../lib/account-ownership.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64OrNull, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { archiveAccountEntity, restoreAccountEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import {
  withAccountRead,
  withAccountTransaction,
  withCrossAccountTransaction,
} from "../lib/rls-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { AccountArchivableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  AccountId,
  AuditEventType,
  BucketId,
  FriendConnectionId,
  FriendConnectionStatus,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface FriendConnectionResult {
  readonly id: FriendConnectionId;
  readonly accountId: AccountId;
  readonly friendAccountId: AccountId;
  readonly status: FriendConnectionStatus;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface FriendConnectionWithRotations extends FriendConnectionResult {
  readonly pendingRotations: ReadonlyArray<{
    readonly systemId: SystemId;
    readonly bucketId: BucketId;
  }>;
}

interface ListFriendConnectionOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: FriendConnectionStatus;
}

interface UpdateFriendVisibilityParams {
  readonly encryptedData: string;
  readonly version: number;
}

// ── Constants ───────────────────────────────────────────────────────

/** Status values that allow transition to blocked. */
const BLOCKABLE_STATUSES: readonly FriendConnectionStatus[] = ["accepted", "pending"];

/** Status values that allow transition to removed. */
const REMOVABLE_STATUSES: readonly FriendConnectionStatus[] = ["accepted", "pending", "blocked"];

/** Status values that allow transition to accepted. */
const ACCEPTABLE_STATUSES: readonly FriendConnectionStatus[] = ["pending"];

/** Status values that allow transition to removed via rejection. */
const REJECTABLE_STATUSES: readonly FriendConnectionStatus[] = ["pending"];

const AUDIT_FRIEND_ACCEPTED: AuditEventType = "friend-connection.accepted";
const AUDIT_FRIEND_REJECTED: AuditEventType = "friend-connection.rejected";
const AUDIT_FRIEND_BLOCKED: AuditEventType = "friend-connection.blocked";
const AUDIT_FRIEND_REMOVED: AuditEventType = "friend-connection.removed";
const AUDIT_VISIBILITY_UPDATED: AuditEventType = "friend-visibility.updated";
const AUDIT_FRIEND_ARCHIVED: AuditEventType = "friend-connection.archived";
const AUDIT_FRIEND_RESTORED: AuditEventType = "friend-connection.restored";

// ── Helpers ─────────────────────────────────────────────────────────

function toFriendConnectionResult(
  row: typeof friendConnections.$inferSelect,
): FriendConnectionResult {
  return {
    id: brandId<FriendConnectionId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    friendAccountId: brandId<AccountId>(row.friendAccountId),
    status: row.status,
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listFriendConnections(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
  opts: ListFriendConnectionOpts = {},
): Promise<PaginatedResult<FriendConnectionResult>> {
  assertAccountOwnership(accountId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const conditions = [eq(friendConnections.accountId, accountId)];

    if (!opts.includeArchived) {
      conditions.push(eq(friendConnections.archived, false));
    }

    if (opts.status) {
      conditions.push(eq(friendConnections.status, opts.status));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "friend-connection");
      const cursorCondition = or(
        lt(friendConnections.createdAt, decoded.sortValue),
        and(
          eq(friendConnections.createdAt, decoded.sortValue),
          lt(friendConnections.id, decoded.id),
        ),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(friendConnections)
      .where(and(...conditions))
      .orderBy(desc(friendConnections.createdAt), desc(friendConnections.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toFriendConnectionResult,
      (i) => i.createdAt,
    );
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  return withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select()
      .from(friendConnections)
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
    }

    return toFriendConnectionResult(row);
  });
}

// ── Private helpers ─────────────────────────────────────────────────

interface StatusTransitionConfig {
  readonly targetStatus: FriendConnectionStatus;
  readonly allowedStatuses: readonly FriendConnectionStatus[];
  readonly auditEventType: AuditEventType;
  readonly auditDetail: string;
}

async function transitionConnectionStatus(
  tx: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  timestamp: UnixMillis,
  auth: AuthContext,
  audit: AuditWriter,
  config: StatusTransitionConfig,
): Promise<{ result: FriendConnectionResult; existing: typeof friendConnections.$inferSelect }> {
  const [existing] = await tx
    .select()
    .from(friendConnections)
    .where(
      and(
        eq(friendConnections.id, connectionId),
        eq(friendConnections.accountId, accountId),
        eq(friendConnections.archived, false),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  if (!config.allowedStatuses.includes(existing.status)) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "CONFLICT",
      `Cannot ${config.targetStatus} connection with status '${existing.status}'`,
    );
  }

  const [row] = await tx
    .update(friendConnections)
    .set({
      status: config.targetStatus,
      updatedAt: timestamp,
      version: sql`${friendConnections.version} + 1`,
    })
    .where(and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)))
    .returning();

  if (!row) {
    throw new Error(`Failed to ${config.targetStatus} friend connection — UPDATE returned no rows`);
  }

  await audit(tx, {
    eventType: config.auditEventType,
    actor: { kind: "account", id: auth.accountId },
    detail: config.auditDetail,
    accountId,
  });

  return { result: toFriendConnectionResult(row), existing };
}

async function updateReverseConnection(
  tx: PostgresJsDatabase,
  accountId: AccountId,
  friendAccountId: string,
  targetStatus: FriendConnectionStatus,
  timestamp: UnixMillis,
): Promise<void> {
  await tx
    .update(friendConnections)
    .set({
      status: targetStatus,
      updatedAt: timestamp,
      version: sql`${friendConnections.version} + 1`,
    })
    .where(
      and(
        eq(friendConnections.accountId, friendAccountId),
        eq(friendConnections.friendAccountId, accountId),
        eq(friendConnections.archived, false),
      ),
    );
}

async function cleanupBucketAssignments(
  tx: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  friendAccountId: string,
  timestamp: UnixMillis,
): Promise<ReadonlyArray<{ readonly systemId: SystemId; readonly bucketId: BucketId }>> {
  const assignments = await tx
    .select({
      bucketId: friendBucketAssignments.bucketId,
      systemId: friendBucketAssignments.systemId,
    })
    .from(friendBucketAssignments)
    .where(eq(friendBucketAssignments.friendConnectionId, connectionId));

  if (assignments.length === 0) {
    return [];
  }

  const bucketIds = assignments.map((a) => a.bucketId);

  await tx
    .delete(friendBucketAssignments)
    .where(eq(friendBucketAssignments.friendConnectionId, connectionId));

  await tx
    .update(keyGrants)
    .set({ revokedAt: timestamp })
    .where(
      and(
        eq(keyGrants.friendAccountId, friendAccountId),
        inArray(keyGrants.bucketId, bucketIds),
        isNull(keyGrants.revokedAt),
      ),
    );

  return assignments.map((a) => ({
    systemId: brandId<SystemId>(a.systemId),
    bucketId: brandId<BucketId>(a.bucketId),
  }));
}

// ── TERMINATE (block / remove) ─────────────────────────────────────

/**
 * Shared implementation for both block and remove operations.
 *
 * Both follow an identical flow:
 * 1. Transition caller's connection status
 * 2. Mirror the status on the reverse connection
 * 3. Clean up bucket assignments in both directions
 * 4. Dispatch friend.removed webhook to the caller's owned systems
 * 5. Return result with pending key rotations
 */
async function terminateConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
  config: StatusTransitionConfig,
): Promise<FriendConnectionWithRotations> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withCrossAccountTransaction(db, async (tx) => {
    const { result, existing } = await transitionConnectionStatus(
      tx,
      accountId,
      connectionId,
      timestamp,
      auth,
      audit,
      config,
    );

    // Update reverse direction
    await updateReverseConnection(
      tx,
      accountId,
      existing.friendAccountId,
      config.targetStatus,
      timestamp,
    );

    // Clean up bucket assignments in both directions
    const callerRotations = await cleanupBucketAssignments(
      tx,
      connectionId,
      existing.friendAccountId,
      timestamp,
    );

    const [reverseConn] = await tx
      .select({ id: friendConnections.id })
      .from(friendConnections)
      .where(
        and(
          eq(friendConnections.accountId, existing.friendAccountId),
          eq(friendConnections.friendAccountId, accountId),
        ),
      )
      .limit(1);

    let reverseRotations: ReadonlyArray<{
      readonly systemId: SystemId;
      readonly bucketId: BucketId;
    }> = [];
    if (reverseConn) {
      reverseRotations = await cleanupBucketAssignments(
        tx,
        brandId<FriendConnectionId>(reverseConn.id),
        accountId,
        timestamp,
      );
    }

    // Dispatch friend.removed to all systems owned by the acting account
    for (const systemId of auth.ownedSystemIds) {
      await dispatchWebhookEvent(tx, systemId, "friend.removed", {
        connectionId,
        friendAccountId: brandId<AccountId>(existing.friendAccountId),
      });
    }

    return {
      ...result,
      pendingRotations: [...callerRotations, ...reverseRotations],
    };
  });
}

// ── ACCEPT ─────────────────────────────────────────────────────────

export async function acceptFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withCrossAccountTransaction(db, async (tx) => {
    const { result, existing } = await transitionConnectionStatus(
      tx,
      accountId,
      connectionId,
      timestamp,
      auth,
      audit,
      {
        targetStatus: "accepted",
        allowedStatuses: ACCEPTABLE_STATUSES,
        auditEventType: AUDIT_FRIEND_ACCEPTED,
        auditDetail: "Friend connection accepted",
      },
    );

    await updateReverseConnection(tx, accountId, existing.friendAccountId, "accepted", timestamp);

    for (const systemId of auth.ownedSystemIds) {
      await dispatchWebhookEvent(tx, systemId, "friend.connected", {
        connectionId,
        friendAccountId: brandId<AccountId>(existing.friendAccountId),
      });
    }

    return result;
  });
}

// ── REJECT ─────────────────────────────────────────────────────────

export async function rejectFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withCrossAccountTransaction(db, async (tx) => {
    const { result, existing } = await transitionConnectionStatus(
      tx,
      accountId,
      connectionId,
      timestamp,
      auth,
      audit,
      {
        targetStatus: "removed",
        allowedStatuses: REJECTABLE_STATUSES,
        auditEventType: AUDIT_FRIEND_REJECTED,
        auditDetail: "Friend connection rejected",
      },
    );

    await updateReverseConnection(tx, accountId, existing.friendAccountId, "removed", timestamp);

    return result;
  });
}

// ── BLOCK ───────────────────────────────────────────────────────────

export function blockFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionWithRotations> {
  return terminateConnection(db, accountId, connectionId, auth, audit, {
    targetStatus: "blocked",
    allowedStatuses: BLOCKABLE_STATUSES,
    auditEventType: AUDIT_FRIEND_BLOCKED,
    auditDetail: "Friend connection blocked",
  });
}

// ── REMOVE ──────────────────────────────────────────────────────────

export function removeFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionWithRotations> {
  return terminateConnection(db, accountId, connectionId, auth, audit, {
    targetStatus: "removed",
    allowedStatuses: REMOVABLE_STATUSES,
    auditEventType: AUDIT_FRIEND_REMOVED,
    auditDetail: "Friend connection removed",
  });
}

// ── UPDATE VISIBILITY ───────────────────────────────────────────────

export async function updateFriendVisibility(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  params: UpdateFriendVisibilityParams,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const blob = validateEncryptedBlob(params.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = params.version;
  const timestamp = now();

  return withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendConnections)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.version, version),
          eq(friendConnections.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: friendConnections.id })
          .from(friendConnections)
          .where(
            and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
          )
          .limit(1);
        return existing;
      },
      "Friend connection",
    );

    await audit(tx, {
      eventType: AUDIT_VISIBILITY_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend visibility updated",
      accountId,
    });

    return toFriendConnectionResult(row);
  });
}

// ── Entity lifecycle config (account-scoped) ──────────────────────

const FRIEND_CONNECTION_LIFECYCLE: AccountArchivableEntityConfig<FriendConnectionId> = {
  table: friendConnections,
  columns: {
    id: friendConnections.id,
    accountId: friendConnections.accountId,
    archived: friendConnections.archived,
    archivedAt: friendConnections.archivedAt,
    updatedAt: friendConnections.updatedAt,
    version: friendConnections.version,
  },
  entityName: "Friend connection",
  archiveEvent: AUDIT_FRIEND_ARCHIVED,
  restoreEvent: AUDIT_FRIEND_RESTORED,
};

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveAccountEntity(db, accountId, connectionId, auth, audit, FRIEND_CONNECTION_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  return restoreAccountEntity(
    db,
    accountId,
    connectionId,
    auth,
    audit,
    FRIEND_CONNECTION_LIFECYCLE,
    (row) => toFriendConnectionResult(row as typeof friendConnections.$inferSelect),
  );
}
