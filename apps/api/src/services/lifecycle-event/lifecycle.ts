import { lifecycleEvents } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";

import { LIFECYCLE_EVENT_LIFECYCLE, toLifecycleEventResult } from "./internal.js";

import type { LifecycleEventResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { LifecycleEventId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, eventId, auth, audit, LIFECYCLE_EVENT_LIFECYCLE);
}

export async function restoreLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  return restoreEntity(db, systemId, eventId, auth, audit, LIFECYCLE_EVENT_LIFECYCLE, (row) =>
    toLifecycleEventResult(row as typeof lifecycleEvents.$inferSelect),
  );
}
