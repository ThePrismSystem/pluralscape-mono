import { customFronts, frontingSessions } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CustomFrontId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: customFronts.id })
      .from(customFronts)
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Custom front not found");
    }

    // Check for fronting sessions referencing this custom front
    const { dependents } = await checkDependents(tx, [
      {
        table: frontingSessions,
        predicate: eq(frontingSessions.customFrontId, customFrontId),
        typeName: "frontingSessions",
      },
    ]);

    const [sessionDep] = dependents;
    if (sessionDep) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Custom front has ${String(sessionDep.count)} fronting session(s). Archive instead of deleting.`,
      );
    }

    await audit(tx, {
      eventType: "custom-front.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front deleted",
      systemId,
    });

    await tx
      .delete(customFronts)
      .where(and(eq(customFronts.id, customFrontId), eq(customFronts.systemId, systemId)));
  });
}
