import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, TimerId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: timerConfigs.id })
      .from(timerConfigs)
      .where(
        and(
          eq(timerConfigs.id, timerId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Timer config not found");
    }

    // Check for non-archived dependent check-in records
    const [recordCount] = await tx
      .select({ count: count() })
      .from(checkInRecords)
      .where(and(eq(checkInRecords.timerConfigId, timerId), eq(checkInRecords.archived, false)));

    if (!recordCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (recordCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Timer config has ${String(recordCount.count)} non-archived check-in record(s). Archive or delete records first.`,
      );
    }

    await tx
      .delete(timerConfigs)
      .where(and(eq(timerConfigs.id, timerId), eq(timerConfigs.systemId, systemId)));

    await audit(tx, {
      eventType: "timer-config.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config deleted",
      systemId,
    });
  });
}
