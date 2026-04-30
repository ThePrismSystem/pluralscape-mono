import { now } from "@pluralscape/types";
import { and, count, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
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

export async function restoreEntity<
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
): Promise<TResult> {
  const { table, columns, entityName, parentFieldName, toResult, events } = cfg;

  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: columns.id, parentId: columns.parentId })
      .from(table)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, true)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Archived ${entityName.toLowerCase()} not found`,
      );
    }

    // Enforce per-system quota on restore if configured
    if (cfg.maxPerSystem !== undefined) {
      const [activeCount] = await tx
        .select({ count: count() })
        .from(table)
        .where(and(eq(columns.systemId, systemId), eq(columns.archived, false)));

      if ((activeCount?.count ?? 0) >= cfg.maxPerSystem) {
        throw new ApiHttpError(
          HTTP_TOO_MANY_REQUESTS,
          "QUOTA_EXCEEDED",
          `Maximum of ${String(cfg.maxPerSystem)} ${entityName.toLowerCase()}s per system`,
        );
      }
    }

    // If parent is archived, promote to root
    let newParentId = typeof existing.parentId === "string" ? existing.parentId : null;
    if (newParentId !== null) {
      const [parent] = await tx
        .select({ archived: columns.archived })
        .from(table)
        .where(and(eq(columns.id, newParentId), eq(columns.systemId, systemId)))
        .limit(1);

      if (!parent || (parent.archived as boolean)) {
        newParentId = null;
      }
    }

    const updated = await tx
      .update(table)
      .set({
        archived: false,
        archivedAt: null,
        [parentFieldName]: newParentId,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Archived ${entityName.toLowerCase()} not found`,
      );
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: events.restored,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} restored`,
      systemId,
    });

    return toResult(row as TRow);
  });
}
