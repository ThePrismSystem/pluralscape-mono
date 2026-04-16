import {
  bucketContentTags,
  customFronts,
  frontingSessions,
  keyGrants,
  members,
  systemStructureEntities,
} from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, countDistinct, eq, inArray, isNull } from "drizzle-orm";

import { filterVisibleEntities, loadBucketTags } from "../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertFriendAccess } from "../lib/friend-access.js";
import { withCrossAccountRead } from "../lib/rls-context.js";
import { MAX_ACTIVE_SESSIONS, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  BucketContentEntityType,
  BucketId,
  CustomFrontId,
  EncryptedBlob,
  FriendConnectionId,
  FriendDashboardResponse,
  FrontingSessionId,
  KeyGrantId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Internal types ─────────────────────────────────────────────

interface DashboardEntityRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
}

/** Decomposed table reference for the generic queryVisibleEntities helper. */
interface DashboardTableRef {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly systemId: PgColumn;
  readonly encryptedData: PgColumn;
  readonly archived: PgColumn;
}

/** Per-request cache key for loadBucketTags results. */
type BucketTagCacheKey = `${string}:${string}`;

/**
 * Request-scoped cache for loadBucketTags results.
 *
 * Created fresh per `getFriendDashboard` call to avoid cross-tenant
 * cache poisoning. Keyed by `systemId:entityType`.
 */
export type BucketTagCache = Map<BucketTagCacheKey, ReadonlyMap<string, readonly BucketId[]>>;

function bucketTagCacheKey(
  systemId: SystemId,
  entityType: BucketContentEntityType,
): BucketTagCacheKey {
  return `${systemId}:${entityType}`;
}

/** Load bucket tags with per-request caching per (systemId, entityType). */
export async function cachedLoadBucketTags(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityIds: readonly string[],
  cache: BucketTagCache,
): Promise<ReadonlyMap<string, readonly BucketId[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const key = bucketTagCacheKey(systemId, entityType);
  const cached = cache.get(key);

  if (cached) {
    const allPresent = entityIds.every((id) => cached.has(id));
    if (allPresent) {
      return cached;
    }
  }

  const result = await loadBucketTags(tx, systemId, entityType, entityIds);

  // Merge with existing cached entries for this key
  const merged = cached ? new Map(cached) : new Map<string, readonly BucketId[]>();
  for (const [entityId, bucketIds] of result) {
    merged.set(entityId, bucketIds);
  }

  cache.set(key, merged);

  return result;
}

// ── Generic visible entities helper (M11 + M3) ────────────────

/**
 * Query non-archived entities visible to a friend via bucket intersection,
 * using an INNER JOIN on bucket_content_tags for SQL-level filtering.
 *
 * This replaces the previous pattern of fetching all entities, loading
 * bucket tags, and filtering in memory.
 */
async function queryVisibleEntities<TId extends string>(
  tx: PostgresJsDatabase,
  ref: DashboardTableRef,
  entityType: BucketContentEntityType,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  mapId: (id: string) => TId,
): Promise<readonly { readonly id: TId; readonly encryptedData: string }[]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const conds: SQL[] = [
    eq(ref.systemId, systemId),
    eq(ref.archived, false),
    inArray(bucketContentTags.bucketId, friendBucketIds),
  ];

  const rows = await tx
    .selectDistinctOn([ref.id], {
      id: ref.id,
      encryptedData: ref.encryptedData,
    })
    .from(ref.table)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, ref.id),
        eq(bucketContentTags.systemId, ref.systemId),
        eq(bucketContentTags.entityType, entityType),
      ),
    )
    .where(and(...conds))
    .limit(MAX_PAGE_LIMIT);

  return (rows as DashboardEntityRow[]).map((r) => ({
    id: mapId(r.id),
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

// ── Table references ───────────────────────────────────────────

const MEMBER_REF: DashboardTableRef = {
  table: members,
  id: members.id,
  systemId: members.systemId,
  encryptedData: members.encryptedData,
  archived: members.archived,
};

const CUSTOM_FRONT_REF: DashboardTableRef = {
  table: customFronts,
  id: customFronts.id,
  systemId: customFronts.systemId,
  encryptedData: customFronts.encryptedData,
  archived: customFronts.archived,
};

const STRUCTURE_ENTITY_REF: DashboardTableRef = {
  table: systemStructureEntities,
  id: systemStructureEntities.id,
  systemId: systemStructureEntities.systemId,
  encryptedData: systemStructureEntities.encryptedData,
  archived: systemStructureEntities.archived,
};

// ── Query helpers ───────────────────────────────────────────────

/**
 * Fetch active fronting sessions visible to a friend via bucket intersection.
 *
 * Visibility is determined by the bucket tags of the session's subject entities
 * (member, custom front, structure entity), NOT the session itself. This aligns
 * with the switch-alert-dispatcher pattern.
 */
export async function queryVisibleActiveFronting(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  cache: BucketTagCache,
): Promise<{
  sessions: FriendDashboardResponse["activeFronting"]["sessions"];
  isCofronting: boolean;
}> {
  if (friendBucketIds.length === 0) {
    return { sessions: [], isCofronting: false };
  }

  const rows = await tx
    .select({
      id: frontingSessions.id,
      memberId: frontingSessions.memberId,
      customFrontId: frontingSessions.customFrontId,
      structureEntityId: frontingSessions.structureEntityId,
      startTime: frontingSessions.startTime,
      encryptedData: frontingSessions.encryptedData,
    })
    .from(frontingSessions)
    .where(
      and(
        eq(frontingSessions.systemId, systemId),
        isNull(frontingSessions.endTime),
        eq(frontingSessions.archived, false),
      ),
    )
    .limit(MAX_ACTIVE_SESSIONS);

  if (rows.length === 0) {
    return { sessions: [], isCofronting: false };
  }

  // Collect subject entity IDs by type
  const memberIds = new Set<string>();
  const customFrontIds = new Set<string>();
  const structureEntityIds = new Set<string>();

  for (const r of rows) {
    if (r.memberId) memberIds.add(r.memberId);
    if (r.customFrontId) customFrontIds.add(r.customFrontId);
    if (r.structureEntityId) structureEntityIds.add(r.structureEntityId);
  }

  // Load bucket tags for each subject entity type in parallel (with caching)
  const [memberBucketMap, cfBucketMap, steBucketMap] = await Promise.all([
    memberIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "member", [...memberIds], cache)
      : new Map<string, BucketId[]>(),
    customFrontIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "custom-front", [...customFrontIds], cache)
      : new Map<string, BucketId[]>(),
    structureEntityIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "structure-entity", [...structureEntityIds], cache)
      : new Map<string, BucketId[]>(),
  ]);

  // Build a session-to-bucket map by merging subject entity bucket tags
  const sessionBucketMap = new Map<string, BucketId[]>();
  for (const r of rows) {
    const sessionBuckets: BucketId[] = [];
    if (r.memberId) {
      const mb = memberBucketMap.get(r.memberId);
      if (mb) sessionBuckets.push(...mb);
    }
    if (r.customFrontId) {
      const cb = cfBucketMap.get(r.customFrontId);
      if (cb) sessionBuckets.push(...cb);
    }
    if (r.structureEntityId) {
      const sb = steBucketMap.get(r.structureEntityId);
      if (sb) sessionBuckets.push(...sb);
    }
    if (sessionBuckets.length > 0) {
      sessionBucketMap.set(r.id, sessionBuckets);
    }
  }

  const visible = filterVisibleEntities(rows, friendBucketIds, sessionBucketMap, (r) => r.id);

  const sessions = visible.map((r) => ({
    id: brandId<FrontingSessionId>(r.id),
    memberId: r.memberId ? brandId<MemberId>(r.memberId) : null,
    customFrontId: r.customFrontId ? brandId<CustomFrontId>(r.customFrontId) : null,
    structureEntityId: r.structureEntityId
      ? brandId<SystemStructureEntityId>(r.structureEntityId)
      : null,
    startTime: r.startTime as UnixMillis,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));

  // Custom fronts represent abstract cognitive states, not members.
  // Only count sessions with a member or structure entity for co-fronting.
  const memberSessions = sessions.filter(
    (s) => s.memberId !== null || s.structureEntityId !== null,
  );

  return {
    sessions,
    isCofronting: memberSessions.length > 1,
  };
}

/** Fetch non-archived members visible to a friend via bucket intersection. */
export async function queryVisibleMembers(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleMembers"]> {
  return queryVisibleEntities(tx, MEMBER_REF, "member", systemId, friendBucketIds, (id) =>
    brandId<MemberId>(id),
  );
}

/** Fetch non-archived custom fronts visible to a friend via bucket intersection. */
export async function queryVisibleCustomFronts(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleCustomFronts"]> {
  return queryVisibleEntities(
    tx,
    CUSTOM_FRONT_REF,
    "custom-front",
    systemId,
    friendBucketIds,
    (id) => brandId<CustomFrontId>(id),
  );
}

/** Fetch non-archived structure entities visible to a friend via bucket intersection. */
export async function queryVisibleStructureEntities(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleStructureEntities"]> {
  return queryVisibleEntities(
    tx,
    STRUCTURE_ENTITY_REF,
    "structure-entity",
    systemId,
    friendBucketIds,
    (id) => brandId<SystemStructureEntityId>(id),
  );
}

/**
 * Count non-archived members visible to a friend via bucket intersection.
 *
 * Uses INNER JOIN on bucket_content_tags to count only members the friend
 * can see, preventing system size leakage (H2 security fix).
 */
export async function queryMemberCount(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<number> {
  if (friendBucketIds.length === 0) {
    return 0;
  }

  const [result] = await tx
    .select({ value: countDistinct(members.id) })
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
        inArray(bucketContentTags.bucketId, friendBucketIds),
      ),
    );

  return result?.value ?? 0;
}

/** Fetch active (non-revoked) key grants for this friend. */
export async function queryActiveKeyGrants(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendAccountId: AccountId,
): Promise<FriendDashboardResponse["keyGrants"]> {
  const rows = await tx
    .select({
      id: keyGrants.id,
      bucketId: keyGrants.bucketId,
      encryptedKey: keyGrants.encryptedKey,
      keyVersion: keyGrants.keyVersion,
    })
    .from(keyGrants)
    .where(
      and(
        eq(keyGrants.systemId, systemId),
        eq(keyGrants.friendAccountId, friendAccountId),
        isNull(keyGrants.revokedAt),
      ),
    );

  return rows.map((r) => ({
    id: brandId<KeyGrantId>(r.id),
    bucketId: brandId<BucketId>(r.bucketId),
    encryptedKey: Buffer.from(r.encryptedKey).toString("base64"),
    keyVersion: r.keyVersion,
  }));
}

// ── Orchestrator ────────────────────────────────────────────────

/**
 * Get the friend dashboard for a connection.
 *
 * Runs assertFriendAccess + all queries in a single withCrossAccountRead
 * transaction to prevent TOCTOU races.
 */
export async function getFriendDashboard(
  db: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendDashboardResponse> {
  return withCrossAccountRead(db, async (tx) => {
    const access = await assertFriendAccess(tx, connectionId, auth);
    const requestCache: BucketTagCache = new Map();

    const [
      activeFronting,
      visibleMembers,
      visibleCustomFronts,
      visibleStructureEntities,
      memberCount,
      activeKeyGrants,
    ] = await Promise.all([
      queryVisibleActiveFronting(tx, access.targetSystemId, access.assignedBucketIds, requestCache),
      queryVisibleMembers(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleCustomFronts(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleStructureEntities(tx, access.targetSystemId, access.assignedBucketIds),
      queryMemberCount(tx, access.targetSystemId, access.assignedBucketIds),
      queryActiveKeyGrants(tx, access.targetSystemId, auth.accountId),
    ]);

    return {
      systemId: access.targetSystemId,
      memberCount,
      activeFronting,
      visibleMembers,
      visibleCustomFronts,
      visibleStructureEntities,
      keyGrants: activeKeyGrants,
    };
  });
}
