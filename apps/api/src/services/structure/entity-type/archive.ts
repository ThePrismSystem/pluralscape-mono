import { archiveEntity } from "../../../lib/entity-lifecycle.js";

import { ENTITY_TYPE_LIFECYCLE } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, entityTypeId, auth, audit, ENTITY_TYPE_LIFECYCLE);
}
