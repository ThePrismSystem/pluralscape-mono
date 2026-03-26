import { friendBucketAssignments, friendConnections, keyGrants } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { assertAccountOwnership } from "../lib/account-ownership.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64OrNull, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  AuditEventType,
  FriendConnectionId,
  FriendConnectionStatus,
  PaginatedResult,
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

interface ListFriendConnectionOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
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

// Audit event types for friend connections.
// These will be added to AuditEventType in packages/types when the friend network types PR lands.
const AUDIT_FRIEND_BLOCKED = "friend-connection.blocked" as AuditEventType;
const AUDIT_FRIEND_REMOVED = "friend-connection.removed" as AuditEventType;
const AUDIT_VISIBILITY_UPDATED = "friend-visibility.updated" as AuditEventType;
const AUDIT_FRIEND_ARCHIVED = "friend-connection.archived" as AuditEventType;
const AUDIT_FRIEND_RESTORED = "friend-connection.restored" as AuditEventType;

// ── Helpers ─────────────────────────────────────────────────────────

function toFriendConnectionResult(
  row: typeof friendConnections.$inferSelect,
): FriendConnectionResult {
  return {
    id: row.id as FriendConnectionId,
    accountId: row.accountId as AccountId,
    friendAccountId: row.friendAccountId as AccountId,
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

// ── BLOCK ───────────────────────────────────────────────────────────

export async function blockFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withAccountTransaction(db, accountId, async (tx) => {
    // Fetch current state
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

    if (!BLOCKABLE_STATUSES.includes(existing.status)) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Cannot block connection with status '${existing.status}'`,
      );
    }

    const [row] = await tx
      .update(friendConnections)
      .set({
        status: "blocked" as FriendConnectionStatus,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
      )
      .returning();

    if (!row) {
      throw new Error("Failed to block friend connection — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_BLOCKED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend connection blocked",
      accountId,
    });

    return toFriendConnectionResult(row);
  });
}

// ── REMOVE ──────────────────────────────────────────────────────────

export async function removeFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withAccountTransaction(db, accountId, async (tx) => {
    // Fetch current state
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

    if (!REMOVABLE_STATUSES.includes(existing.status)) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        `Cannot remove connection with status '${existing.status}'`,
      );
    }

    // Update status to removed
    const [row] = await tx
      .update(friendConnections)
      .set({
        status: "removed" as FriendConnectionStatus,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
      )
      .returning();

    if (!row) {
      throw new Error("Failed to remove friend connection — UPDATE returned no rows");
    }

    // Cleanup: find bucket assignments for this connection
    const assignments = await tx
      .select({ bucketId: friendBucketAssignments.bucketId })
      .from(friendBucketAssignments)
      .where(eq(friendBucketAssignments.friendConnectionId, connectionId));

    const bucketIds = assignments.map((a) => a.bucketId);

    // Delete all bucket assignments for this connection
    await tx
      .delete(friendBucketAssignments)
      .where(eq(friendBucketAssignments.friendConnectionId, connectionId));

    // Revoke key grants for this friend account on those buckets
    if (bucketIds.length > 0) {
      await tx
        .update(keyGrants)
        .set({ revokedAt: timestamp })
        .where(
          and(
            eq(keyGrants.friendAccountId, existing.friendAccountId),
            inArray(keyGrants.bucketId, bucketIds),
            isNull(keyGrants.revokedAt),
          ),
        );
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_REMOVED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend connection removed",
      accountId,
    });

    return toFriendConnectionResult(row);
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

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendConnections)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.archived, false),
        ),
      )
      .returning({ id: friendConnections.id });

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: friendConnections.id })
        .from(friendConnections)
        .where(
          and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
        );

      if (existing) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Friend connection is already archived",
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_ARCHIVED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend connection archived",
      accountId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();

  return withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendConnections)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.archived, true),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const [existing] = await tx
        .select({ id: friendConnections.id })
        .from(friendConnections)
        .where(
          and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
        );

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "NOT_ARCHIVED", "Friend connection is not archived");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived friend connection not found");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_RESTORED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend connection restored",
      accountId,
    });

    return toFriendConnectionResult(row);
  });
}
