import {
  bucketContentTags,
  customFronts,
  frontingSessions,
  members,
  systemStructureEntities,
} from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, countDistinct, eq, inArray, isNull, max } from "drizzle-orm";

import { assertFriendAccess } from "../lib/friend-access.js";
import { withCrossAccountRead } from "../lib/rls-context.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketId,
  FriendConnectionId,
  FriendDashboardSyncEntry,
  FriendDashboardSyncResponse,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Query helpers ──────────────────────────────────────────────────

/**
 * Count and find the latest updatedAt for visible members filtered by bucket access.
 */
async function memberSyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketIds: readonly BucketId[],
): Promise<FriendDashboardSyncEntry> {
  if (bucketIds.length === 0) {
    return { entityType: "member", count: 0, latestUpdatedAt: 0 as UnixMillis };
  }

  const [result] = await tx
    .select({
      count: countDistinct(members.id),
      latest: max(members.updatedAt),
    })
    .from(members)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, members.id),
        eq(bucketContentTags.systemId, members.systemId),
        eq(bucketContentTags.entityType, "member"),
      ),
    )
    .where(
      and(
        eq(members.systemId, systemId),
        eq(members.archived, false),
        inArray(bucketContentTags.bucketId, bucketIds),
      ),
    );

  return {
    entityType: "member",
    count: result?.count ?? 0,
    latestUpdatedAt: toUnixMillis(result?.latest ?? 0),
  };
}

async function customFrontSyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketIds: readonly BucketId[],
): Promise<FriendDashboardSyncEntry> {
  if (bucketIds.length === 0) {
    return { entityType: "custom-front", count: 0, latestUpdatedAt: 0 as UnixMillis };
  }

  const [result] = await tx
    .select({
      count: countDistinct(customFronts.id),
      latest: max(customFronts.updatedAt),
    })
    .from(customFronts)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, customFronts.id),
        eq(bucketContentTags.systemId, customFronts.systemId),
        eq(bucketContentTags.entityType, "custom-front"),
      ),
    )
    .where(
      and(
        eq(customFronts.systemId, systemId),
        eq(customFronts.archived, false),
        inArray(bucketContentTags.bucketId, bucketIds),
      ),
    );

  return {
    entityType: "custom-front",
    count: result?.count ?? 0,
    latestUpdatedAt: toUnixMillis(result?.latest ?? 0),
  };
}

async function structureEntitySyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketIds: readonly BucketId[],
): Promise<FriendDashboardSyncEntry> {
  if (bucketIds.length === 0) {
    return { entityType: "structure-entity", count: 0, latestUpdatedAt: 0 as UnixMillis };
  }

  const [result] = await tx
    .select({
      count: countDistinct(systemStructureEntities.id),
      latest: max(systemStructureEntities.updatedAt),
    })
    .from(systemStructureEntities)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, systemStructureEntities.id),
        eq(bucketContentTags.systemId, systemStructureEntities.systemId),
        eq(bucketContentTags.entityType, "structure-entity"),
      ),
    )
    .where(
      and(
        eq(systemStructureEntities.systemId, systemId),
        eq(systemStructureEntities.archived, false),
        inArray(bucketContentTags.bucketId, bucketIds),
      ),
    );

  return {
    entityType: "structure-entity",
    count: result?.count ?? 0,
    latestUpdatedAt: toUnixMillis(result?.latest ?? 0),
  };
}

async function frontingSessionSyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
): Promise<FriendDashboardSyncEntry> {
  const [result] = await tx
    .select({
      count: countDistinct(frontingSessions.id),
      latest: max(frontingSessions.updatedAt),
    })
    .from(frontingSessions)
    .where(
      and(
        eq(frontingSessions.systemId, systemId),
        isNull(frontingSessions.endTime),
        eq(frontingSessions.archived, false),
      ),
    );

  return {
    entityType: "fronting-session",
    count: result?.count ?? 0,
    latestUpdatedAt: toUnixMillis(result?.latest ?? 0),
  };
}

// ── Orchestrator ───────────────────────────────────────────────────

/**
 * Get the friend dashboard sync projection for a connection.
 *
 * Returns per-entity-type counts and latest timestamps so the client
 * can determine which entity types need incremental sync.
 */
export async function getFriendDashboardSync(
  db: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendDashboardSyncResponse> {
  return withCrossAccountRead(db, async (tx) => {
    const access = await assertFriendAccess(tx, connectionId, auth);

    const entries = await Promise.all([
      memberSyncEntry(tx, access.targetSystemId, access.assignedBucketIds),
      customFrontSyncEntry(tx, access.targetSystemId, access.assignedBucketIds),
      structureEntitySyncEntry(tx, access.targetSystemId, access.assignedBucketIds),
      frontingSessionSyncEntry(tx, access.targetSystemId),
    ]);

    return {
      systemId: access.targetSystemId,
      entries,
    };
  });
}
