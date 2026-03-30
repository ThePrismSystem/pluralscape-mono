import {
  bucketContentTags,
  customFronts,
  frontingSessions,
  members,
  systemStructureEntities,
} from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, countDistinct, eq, inArray, isNull, max, sql } from "drizzle-orm";

import { assertFriendAccess } from "../lib/friend-access.js";
import { withCrossAccountRead } from "../lib/rls-context.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketId,
  FriendConnectionId,
  FriendDashboardEntityType,
  FriendDashboardSyncEntry,
  FriendDashboardSyncResponse,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Bucket-filtered sync config ───────────────────────────────────

/** Column references needed to build the bucket-filtered count + latest query. */
interface BucketSyncTableConfig {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly systemId: PgColumn;
  readonly archived: PgColumn;
  readonly updatedAt: PgColumn;
  readonly entityType: FriendDashboardEntityType;
}

const MEMBER_SYNC_CONFIG: BucketSyncTableConfig = {
  table: members,
  id: members.id,
  systemId: members.systemId,
  archived: members.archived,
  updatedAt: members.updatedAt,
  entityType: "member",
};

const CUSTOM_FRONT_SYNC_CONFIG: BucketSyncTableConfig = {
  table: customFronts,
  id: customFronts.id,
  systemId: customFronts.systemId,
  archived: customFronts.archived,
  updatedAt: customFronts.updatedAt,
  entityType: "custom-front",
};

const STRUCTURE_ENTITY_SYNC_CONFIG: BucketSyncTableConfig = {
  table: systemStructureEntities,
  id: systemStructureEntities.id,
  systemId: systemStructureEntities.systemId,
  archived: systemStructureEntities.archived,
  updatedAt: systemStructureEntities.updatedAt,
  entityType: "structure-entity",
};

// ── Query helpers ──────────────────────────────────────────────────

/**
 * Generic bucket-filtered sync entry: counts distinct entities visible
 * through the given buckets and finds their latest updatedAt timestamp.
 *
 * Uses typed sql fragments for aggregates because `max(PgColumn)` loses
 * the concrete data type when the column is passed generically.
 */
async function bucketFilteredSyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketIds: readonly BucketId[],
  config: BucketSyncTableConfig,
): Promise<FriendDashboardSyncEntry> {
  if (bucketIds.length === 0) {
    return { entityType: config.entityType, count: 0, latestUpdatedAt: 0 as UnixMillis };
  }

  const [result] = await tx
    .select({
      count: sql<number>`count(distinct ${config.id})`,
      latest: sql<number | null>`max(${config.updatedAt})`,
    })
    .from(config.table)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, config.id),
        eq(bucketContentTags.systemId, config.systemId),
        eq(bucketContentTags.entityType, config.entityType),
      ),
    )
    .where(
      and(
        eq(config.systemId, systemId),
        eq(config.archived, false),
        inArray(bucketContentTags.bucketId, bucketIds),
      ),
    );

  return {
    entityType: config.entityType,
    count: result?.count ?? 0,
    latestUpdatedAt: toUnixMillis(result?.latest ?? 0),
  };
}

async function frontingSessionSyncEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketIds: readonly BucketId[],
): Promise<FriendDashboardSyncEntry> {
  if (bucketIds.length === 0) {
    return { entityType: "fronting-session", count: 0, latestUpdatedAt: 0 as UnixMillis };
  }

  const [result] = await tx
    .select({
      count: countDistinct(frontingSessions.id),
      latest: max(frontingSessions.updatedAt),
    })
    .from(frontingSessions)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, frontingSessions.memberId),
        eq(bucketContentTags.systemId, frontingSessions.systemId),
        eq(bucketContentTags.entityType, "member"),
      ),
    )
    .where(
      and(
        eq(frontingSessions.systemId, systemId),
        isNull(frontingSessions.endTime),
        eq(frontingSessions.archived, false),
        inArray(bucketContentTags.bucketId, bucketIds),
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
      bucketFilteredSyncEntry(
        tx,
        access.targetSystemId,
        access.assignedBucketIds,
        MEMBER_SYNC_CONFIG,
      ),
      bucketFilteredSyncEntry(
        tx,
        access.targetSystemId,
        access.assignedBucketIds,
        CUSTOM_FRONT_SYNC_CONFIG,
      ),
      bucketFilteredSyncEntry(
        tx,
        access.targetSystemId,
        access.assignedBucketIds,
        STRUCTURE_ENTITY_SYNC_CONFIG,
      ),
      frontingSessionSyncEntry(tx, access.targetSystemId, access.assignedBucketIds),
    ]);

    return {
      systemId: access.targetSystemId,
      entries,
    };
  });
}
