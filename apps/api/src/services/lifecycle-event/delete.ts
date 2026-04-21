import { lifecycleEvents } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { LifecycleEventId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(lifecycleEvents)
      .where(and(eq(lifecycleEvents.id, eventId), eq(lifecycleEvents.systemId, systemId)))
      .returning({ id: lifecycleEvents.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
    }

    await audit(tx, {
      eventType: "lifecycle-event.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Lifecycle event deleted",
      systemId,
    });
  });
}
