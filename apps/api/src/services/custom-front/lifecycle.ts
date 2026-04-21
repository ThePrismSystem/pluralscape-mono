import { customFronts } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";

import { toCustomFrontResult } from "./internal.js";

import type { CustomFrontResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CustomFrontId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const CUSTOM_FRONT_LIFECYCLE = {
  table: customFronts,
  columns: customFronts,
  entityName: "Custom front",
  archiveEvent: "custom-front.archived" as const,
  restoreEvent: "custom-front.restored" as const,
};

export async function archiveCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, customFrontId, auth, audit, CUSTOM_FRONT_LIFECYCLE);
}

export async function restoreCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  return restoreEntity(db, systemId, customFrontId, auth, audit, CUSTOM_FRONT_LIFECYCLE, (row) =>
    toCustomFrontResult(row as typeof customFronts.$inferSelect),
  );
}
