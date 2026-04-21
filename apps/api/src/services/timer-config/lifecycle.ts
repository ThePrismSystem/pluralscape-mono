import { timerConfigs } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";

import { toTimerConfigResult } from "./internal.js";

import type { TimerConfigResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, TimerId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const TIMER_CONFIG_LIFECYCLE = {
  table: timerConfigs,
  columns: timerConfigs,
  entityName: "Timer config",
  archiveEvent: "timer-config.archived" as const,
  restoreEvent: "timer-config.restored" as const,
};

export async function archiveTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, timerId, auth, audit, TIMER_CONFIG_LIFECYCLE);
}

export async function restoreTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  return restoreEntity(db, systemId, timerId, auth, audit, TIMER_CONFIG_LIFECYCLE, (row) =>
    toTimerConfigResult(row as typeof timerConfigs.$inferSelect),
  );
}
