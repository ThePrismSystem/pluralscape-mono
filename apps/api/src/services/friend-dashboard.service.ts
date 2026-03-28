import {
  bucketContentTags,
  customFronts,
  frontingSessions,
  keyGrants,
  members,
  systemStructureEntities,
} from "@pluralscape/db/pg";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { filterVisibleEntities } from "../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertFriendAccess } from "../lib/friend-access.js";
import { withCrossAccountRead } from "../lib/rls-context.js";
import { MAX_ACTIVE_SESSIONS, MAX_IN_CLAUSE_SIZE, MAX_PAGE_LIMIT } from "../service.constants.js";

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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Internal result types (DB row → dashboard shape) ────────────

interface DashboardEntityRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
}

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

  // Load bucket tags for each subject entity type in parallel
  const [memberBucketMap, cfBucketMap, steBucketMap] = await Promise.all([
    memberIds.size > 0
      ? loadBucketTags(tx, systemId, "member", [...memberIds])
      : new Map<string, BucketId[]>(),
    customFrontIds.size > 0
      ? loadBucketTags(tx, systemId, "custom-front", [...customFrontIds])
      : new Map<string, BucketId[]>(),
    structureEntityIds.size > 0
      ? loadBucketTags(tx, systemId, "structure-entity", [...structureEntityIds])
      : new Map<string, BucketId[]>(),
  ]);

  // Build a session-to-bucket map by merging subject entity bucket tags
  const sessionBucketMap = new Map<string, BucketId[]>();
  for (const r of rows) {
    const buckets: BucketId[] = [];
    if (r.memberId) {
      const mb = memberBucketMap.get(r.memberId);
      if (mb) buckets.push(...mb);
    }
    if (r.customFrontId) {
      const cb = cfBucketMap.get(r.customFrontId);
      if (cb) buckets.push(...cb);
    }
    if (r.structureEntityId) {
      const sb = steBucketMap.get(r.structureEntityId);
      if (sb) buckets.push(...sb);
    }
    if (buckets.length > 0) {
      sessionBucketMap.set(r.id, buckets);
    }
  }

  const visible = filterVisibleEntities(rows, friendBucketIds, sessionBucketMap, (r) => r.id);

  const sessions = visible.map((r) => ({
    id: r.id as FrontingSessionId,
    memberId: r.memberId as MemberId | null,
    customFrontId: r.customFrontId as CustomFrontId | null,
    structureEntityId: r.structureEntityId as SystemStructureEntityId | null,
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
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: members.id,
      encryptedData: members.encryptedData,
    })
    .from(members)
    .where(and(eq(members.systemId, systemId), eq(members.archived, false)))
    .limit(MAX_PAGE_LIMIT);

  const memberIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "member", memberIds);
  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as MemberId,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Fetch non-archived custom fronts visible to a friend via bucket intersection. */
export async function queryVisibleCustomFronts(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleCustomFronts"]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: customFronts.id,
      encryptedData: customFronts.encryptedData,
    })
    .from(customFronts)
    .where(and(eq(customFronts.systemId, systemId), eq(customFronts.archived, false)))
    .limit(MAX_PAGE_LIMIT);

  const cfIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "custom-front", cfIds);
  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as CustomFrontId,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Fetch non-archived structure entities visible to a friend via bucket intersection. */
export async function queryVisibleStructureEntities(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleStructureEntities"]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: systemStructureEntities.id,
      encryptedData: systemStructureEntities.encryptedData,
    })
    .from(systemStructureEntities)
    .where(
      and(
        eq(systemStructureEntities.systemId, systemId),
        eq(systemStructureEntities.archived, false),
      ),
    )
    .limit(MAX_PAGE_LIMIT);

  const entityIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "structure-entity", entityIds);
  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as SystemStructureEntityId,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Count total non-archived members (NOT bucket-filtered). */
export async function queryMemberCount(
  tx: PostgresJsDatabase,
  systemId: SystemId,
): Promise<number> {
  const [result] = await tx
    .select({ value: count() })
    .from(members)
    .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

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
    id: r.id as KeyGrantId,
    bucketId: r.bucketId as BucketId,
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

    const [
      activeFronting,
      visibleMembers,
      visibleCustomFronts,
      visibleStructureEntities,
      memberCount,
      activeKeyGrants,
    ] = await Promise.all([
      queryVisibleActiveFronting(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleMembers(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleCustomFronts(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleStructureEntities(tx, access.targetSystemId, access.assignedBucketIds),
      queryMemberCount(tx, access.targetSystemId),
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

// ── Internal helpers ────────────────────────────────────────────

/**
 * Load bucket content tags for a set of entities and build a map
 * from entity ID to bucket IDs.
 *
 * Batches the IN clause when entityIds exceeds MAX_IN_CLAUSE_SIZE
 * to avoid hitting PostgreSQL parameter limits.
 */
async function loadBucketTags(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, readonly BucketId[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const map = new Map<string, BucketId[]>();

  // Batch the IN clause for large entity sets
  for (let offset = 0; offset < entityIds.length; offset += MAX_IN_CLAUSE_SIZE) {
    const batch = entityIds.slice(offset, offset + MAX_IN_CLAUSE_SIZE);

    const tags = await tx
      .select({
        entityId: bucketContentTags.entityId,
        bucketId: bucketContentTags.bucketId,
      })
      .from(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.systemId, systemId),
          eq(bucketContentTags.entityType, entityType),
          inArray(bucketContentTags.entityId, batch),
        ),
      );

    for (const tag of tags) {
      const existing = map.get(tag.entityId);
      if (existing) {
        existing.push(tag.bucketId as BucketId);
      } else {
        map.set(tag.entityId, [tag.bucketId as BucketId]);
      }
    }
  }

  return map;
}
