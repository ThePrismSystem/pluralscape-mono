import { members } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";

import { MAX_MEMBERS_PER_SYSTEM } from "../../quota.constants.js";
import { queryVisibleEntities } from "./internal.js";

import type { DashboardTableRef } from "./internal.js";
import type {
  BucketId,
  FriendDashboardResponse,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const MEMBER_REF: DashboardTableRef = {
  table: members,
  id: members.id,
  systemId: members.systemId,
  encryptedData: members.encryptedData,
  archived: members.archived,
};

/**
 * Fetch non-archived members visible to a friend via bucket intersection.
 *
 * Upper-bounded by MAX_MEMBERS_PER_SYSTEM — the same system-wide quota the
 * member service enforces on writes. Previously capped at the generic
 * MAX_PAGE_LIMIT (100), which silently truncated systems with more visible
 * members. Clients that need incremental pagination over very large result
 * sets should use `getFriendExportPage` (cursor-based) instead.
 */
export async function queryVisibleMembers(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleMembers"]> {
  return queryVisibleEntities(
    tx,
    MEMBER_REF,
    "member",
    systemId,
    friendBucketIds,
    (id) => brandId<MemberId>(id),
    MAX_MEMBERS_PER_SYSTEM,
  );
}
