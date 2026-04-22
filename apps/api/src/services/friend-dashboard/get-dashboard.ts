import { assertFriendAccess } from "../../lib/friend-access.js";
import { withCrossAccountRead } from "../../lib/rls-context.js";

import { queryVisibleActiveFronting } from "./query-active-fronting.js";
import { queryActiveKeyGrants } from "./query-active-key-grants.js";
import { queryMemberCount } from "./query-member-count.js";
import { queryVisibleCustomFronts } from "./query-visible-custom-fronts.js";
import { queryVisibleMembers } from "./query-visible-members.js";
import { queryVisibleStructureEntities } from "./query-visible-structure-entities.js";

import type { BucketTagCache } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FriendConnectionId, FriendDashboardResponse } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
