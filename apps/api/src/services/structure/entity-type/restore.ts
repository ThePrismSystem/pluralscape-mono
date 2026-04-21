import { systemStructureEntityTypes } from "@pluralscape/db/pg";

import { restoreEntity } from "../../../lib/entity-lifecycle.js";

import { ENTITY_TYPE_LIFECYCLE, toEntityTypeResult, type EntityTypeResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function restoreEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  return restoreEntity(db, systemId, entityTypeId, auth, audit, ENTITY_TYPE_LIFECYCLE, (row) =>
    toEntityTypeResult(row as typeof systemStructureEntityTypes.$inferSelect),
  );
}
