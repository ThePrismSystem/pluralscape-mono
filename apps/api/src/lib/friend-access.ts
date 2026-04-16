import { friendBucketAssignments, friendConnections, systems } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendAccessContext,
  FriendConnectionId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Verify that the authenticated user has friend access to a target system
 * and return the access context (target system, bucket assignments).
 *
 * Must be called inside a `withCrossAccountRead` transaction (no RLS context).
 * Returns 404 on every failure to avoid revealing existence of connections.
 */
export async function assertFriendAccess(
  tx: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendAccessContext> {
  // 1. Load the connection
  const [connection] = await tx
    .select({
      id: friendConnections.id,
      accountId: friendConnections.accountId,
      friendAccountId: friendConnections.friendAccountId,
      status: friendConnections.status,
      archived: friendConnections.archived,
    })
    .from(friendConnections)
    .where(eq(friendConnections.id, connectionId));

  if (!connection) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  // 2. Verify caller owns this connection (404, not 403)
  if (connection.accountId !== auth.accountId) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  // 3. Verify accepted and not archived
  if (connection.status !== "accepted" || connection.archived) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  // Find the inverse connection to load bucket assignments.
  // The target system owner (A) assigned buckets to their connection record (A -> B).
  // The caller (B) provided their connection record (B -> A).
  const [inverseConnection] = await tx
    .select({ id: friendConnections.id })
    .from(friendConnections)
    .where(
      and(
        eq(friendConnections.accountId, connection.friendAccountId),
        eq(friendConnections.friendAccountId, connection.accountId),
        eq(friendConnections.status, "accepted"),
        eq(friendConnections.archived, false),
      ),
    )
    .limit(1);

  if (!inverseConnection) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
  }

  // 4. Load bucket assignments (includes systemId)
  const assignments = await tx
    .select({
      bucketId: friendBucketAssignments.bucketId,
      systemId: friendBucketAssignments.systemId,
    })
    .from(friendBucketAssignments)
    .where(eq(friendBucketAssignments.friendConnectionId, inverseConnection.id));

  const assignedBucketIds = assignments.map((a) => brandId<BucketId>(a.bucketId));

  // 5. Derive target system from assignments, or fall back to systems table
  let targetSystemId: SystemId;

  const firstAssignment = assignments[0];
  if (firstAssignment) {
    targetSystemId = brandId<SystemId>(firstAssignment.systemId);

    // Validate all assignments reference the same system (data integrity check)
    const mixedSystems = assignments.some((a) => a.systemId !== firstAssignment.systemId);
    if (mixedSystems) {
      throw new ApiHttpError(
        HTTP_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Bucket assignments reference multiple systems",
      );
    }
  } else {
    const [system] = await tx
      .select({ id: systems.id })
      .from(systems)
      .where(and(eq(systems.accountId, connection.friendAccountId), eq(systems.archived, false)))
      .limit(1);

    if (!system) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
    }

    targetSystemId = brandId<SystemId>(system.id);
  }

  return {
    targetAccountId: brandId<AccountId>(connection.friendAccountId),
    targetSystemId,
    connectionId,
    assignedBucketIds,
  };
}
