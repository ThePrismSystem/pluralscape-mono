import { customFronts } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";

import { MAX_CUSTOM_FRONTS_PER_SYSTEM } from "../../quota.constants.js";

import { queryVisibleEntities } from "./internal.js";

import type { DashboardTableRef } from "./internal.js";
import type {
  BucketId,
  CustomFrontId,
  FriendDashboardResponse,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const CUSTOM_FRONT_REF: DashboardTableRef = {
  table: customFronts,
  id: customFronts.id,
  systemId: customFronts.systemId,
  encryptedData: customFronts.encryptedData,
  archived: customFronts.archived,
};

/**
 * Fetch non-archived custom fronts visible to a friend via bucket intersection.
 *
 * Upper-bounded by MAX_CUSTOM_FRONTS_PER_SYSTEM to prevent silent truncation.
 */
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
    MAX_CUSTOM_FRONTS_PER_SYSTEM,
  );
}
