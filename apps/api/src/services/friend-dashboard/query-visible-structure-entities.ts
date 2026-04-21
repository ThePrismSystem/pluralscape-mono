import { systemStructureEntities } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";

import { MAX_INNERWORLD_ENTITIES_PER_SYSTEM } from "../../quota.constants.js";
import { queryVisibleEntities } from "./internal.js";

import type { DashboardTableRef } from "./internal.js";
import type {
  BucketId,
  FriendDashboardResponse,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const STRUCTURE_ENTITY_REF: DashboardTableRef = {
  table: systemStructureEntities,
  id: systemStructureEntities.id,
  systemId: systemStructureEntities.systemId,
  encryptedData: systemStructureEntities.encryptedData,
  archived: systemStructureEntities.archived,
};

/**
 * Fetch non-archived structure entities visible to a friend via bucket intersection.
 *
 * Upper-bounded by MAX_INNERWORLD_ENTITIES_PER_SYSTEM — the system-wide cap
 * that the innerworld service enforces on writes.
 */
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
    MAX_INNERWORLD_ENTITIES_PER_SYSTEM,
  );
}
