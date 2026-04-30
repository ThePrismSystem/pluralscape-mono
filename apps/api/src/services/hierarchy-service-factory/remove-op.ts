import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  HierarchyCreateBody,
  HierarchyServiceConfig,
  HierarchyUpdateBody,
} from "../hierarchy-service-types.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function removeEntity<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const { table, columns, entityName, events, dependentChecks } = cfg;

  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify entity exists
    const [existing] = await tx
      .select({ id: columns.id })
      .from(table)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, false)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
    }

    // Translate the factory's narrow shape (entityColumn + systemColumn
    // + optional archived filter) into the shared helper's generic
    // predicate form. Error payload matches other services: narrative
    // message plus a structured `{ dependents }` detail for clients that
    // want to render per-type counts.
    const checks = dependentChecks.map((dep) => {
      const conditions = [eq(dep.entityColumn, entityId), eq(dep.systemColumn, systemId)];
      if (dep.filterArchived) {
        conditions.push(eq(dep.filterArchived, false));
      }
      return {
        table: dep.table,
        predicate: and(...conditions),
        typeName: dep.label,
      };
    });

    const { dependents } = await checkDependents(tx, checks);

    if (dependents.length > 0) {
      const parts = dependents.map((d) => `${String(d.count)} ${d.type}`);
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `${entityName} has ${parts.join(" and ")}. Remove all dependents before deleting.`,
        { dependents },
      );
    }

    // Audit before delete (FK satisfied since entity still exists)
    await audit(tx, {
      eventType: events.deleted,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} deleted`,
      systemId,
    });

    // Hard delete
    await tx.delete(table).where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)));
  });
}
