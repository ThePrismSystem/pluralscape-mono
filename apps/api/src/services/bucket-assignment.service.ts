import { friendBucketAssignments, friendConnections, keyGrants } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import { assertBucketExists } from "./bucket/internal.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { AccountId, BucketId, FriendConnectionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface AssignBucketParams {
  readonly connectionId: FriendConnectionId;
  readonly encryptedBucketKey: string;
  readonly keyVersion: number;
}

export interface BucketAssignmentResult {
  readonly friendConnectionId: FriendConnectionId;
  readonly bucketId: BucketId;
  readonly friendAccountId: AccountId;
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Assert a friend connection exists, is not archived, and has "accepted" status.
 * Returns the connection row including friendAccountId needed for key grants.
 * Throws NOT_FOUND if the connection does not exist or is archived.
 * Throws CONNECTION_NOT_ACCEPTED if the connection exists but is not accepted.
 */
async function assertAcceptedConnection(
  tx: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
): Promise<{ friendAccountId: AccountId }> {
  const [connection] = await tx
    .select({
      id: friendConnections.id,
      friendAccountId: friendConnections.friendAccountId,
      status: friendConnections.status,
      archived: friendConnections.archived,
    })
    .from(friendConnections)
    .where(
      and(
        eq(friendConnections.id, connectionId),
        eq(friendConnections.accountId, accountId),
        eq(friendConnections.archived, false),
      ),
    )
    .limit(1);

  if (!connection) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  if (connection.status !== "accepted") {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "CONNECTION_NOT_ACCEPTED",
      "Friend connection must be accepted before assigning buckets",
    );
  }

  return { friendAccountId: brandId<AccountId>(connection.friendAccountId) };
}

// ── ASSIGN ──────────────────────────────────────────────────────────

export async function assignBucketToFriend(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: AssignBucketParams,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketAssignmentResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertBucketExists(tx, systemId, bucketId);

    const { friendAccountId } = await assertAcceptedConnection(
      tx,
      auth.accountId,
      params.connectionId,
    );

    // Idempotent insert — onConflictDoNothing prevents duplicate rows
    const [inserted] = await tx
      .insert(friendBucketAssignments)
      .values({
        friendConnectionId: params.connectionId,
        bucketId,
        systemId,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      // Only create key grant and emit audit for new assignments
      const keyGrantId = createId(ID_PREFIXES.keyGrant);
      const timestamp = now();
      const encryptedKeyBinary = Buffer.from(params.encryptedBucketKey, "base64");

      await tx.insert(keyGrants).values({
        id: keyGrantId,
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: encryptedKeyBinary,
        keyVersion: params.keyVersion,
        createdAt: timestamp,
      });

      await audit(tx, {
        eventType: "friend-bucket-assignment.assigned",
        actor: { kind: "account", id: auth.accountId },
        detail: `Assigned bucket to friend connection ${params.connectionId}`,
        systemId,
      });
      await dispatchWebhookEvent(tx, systemId, "friend.bucket-assigned", {
        connectionId: params.connectionId,
        bucketId,
      });
    }

    return {
      friendConnectionId: params.connectionId,
      bucketId,
      friendAccountId,
    };
  });
}

// ── UNASSIGN ────────────────────────────────────────────────────────

export interface UnassignBucketResult {
  readonly pendingRotation: { readonly systemId: SystemId; readonly bucketId: BucketId };
}

export async function unassignBucketFromFriend(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<UnassignBucketResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Look up the connection to get friendAccountId for key grant revocation
    const { friendAccountId } = await assertAcceptedConnection(tx, auth.accountId, connectionId);

    const deleted = await tx
      .delete(friendBucketAssignments)
      .where(
        and(
          eq(friendBucketAssignments.friendConnectionId, connectionId),
          eq(friendBucketAssignments.bucketId, bucketId),
          eq(friendBucketAssignments.systemId, systemId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Bucket assignment not found");
    }

    // Revoke all key grants for this friend + bucket combination
    const timestamp = now();
    await tx
      .update(keyGrants)
      .set({ revokedAt: timestamp })
      .where(
        and(
          eq(keyGrants.bucketId, bucketId),
          eq(keyGrants.systemId, systemId),
          eq(keyGrants.friendAccountId, friendAccountId),
        ),
      );

    await audit(tx, {
      eventType: "friend-bucket-assignment.unassigned",
      actor: { kind: "account", id: auth.accountId },
      detail: `Unassigned bucket from friend connection ${connectionId}`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "friend.bucket-unassigned", {
      connectionId,
      bucketId,
    });

    return { pendingRotation: { systemId, bucketId } };
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listFriendBucketAssignments(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
): Promise<readonly BucketAssignmentResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select({
        friendConnectionId: friendBucketAssignments.friendConnectionId,
        bucketId: friendBucketAssignments.bucketId,
        friendAccountId: friendConnections.friendAccountId,
      })
      .from(friendBucketAssignments)
      .innerJoin(
        friendConnections,
        eq(friendBucketAssignments.friendConnectionId, friendConnections.id),
      )
      .where(
        and(
          eq(friendBucketAssignments.bucketId, bucketId),
          eq(friendBucketAssignments.systemId, systemId),
        ),
      );

    return rows.map((row) => ({
      friendConnectionId: brandId<FriendConnectionId>(row.friendConnectionId),
      bucketId: brandId<BucketId>(row.bucketId),
      friendAccountId: brandId<AccountId>(row.friendAccountId),
    }));
  });
}
