import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";
import { assertSystemOwnership } from "./system-ownership.js";

import type { AuditWriter } from "./audit-writer.js";
import type { AuthContext } from "./auth-context.js";
import type { AuditEventType, SystemId } from "@pluralscape/types";
import type { ColumnBaseConfig, ColumnDataType } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type AnyPgColumn = PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object>;

/** Column references needed for archive/restore operations. */
export interface ArchivableColumns {
  readonly id: AnyPgColumn;
  readonly systemId: AnyPgColumn;
  readonly archived: AnyPgColumn;
  readonly archivedAt: AnyPgColumn;
  readonly updatedAt: AnyPgColumn;
  readonly version: AnyPgColumn;
}

/** Configuration for a generic archivable entity. */
export interface ArchivableEntityConfig {
  readonly table: PgTable;
  readonly columns: ArchivableColumns;
  readonly entityName: string;
  readonly archiveEvent: AuditEventType;
  readonly restoreEvent: AuditEventType;
}

/** Archive an entity by setting archived=true within a transaction. */
export async function archiveEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: ArchivableEntityConfig,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();
  const { table, columns, entityName, archiveEvent } = cfg;

  await db.transaction(async (tx) => {
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

    await tx
      .update(table)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
      } as Record<string, unknown>)
      .where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)));

    await audit(tx, {
      eventType: archiveEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} archived`,
      systemId,
    });
  });
}

/**
 * Restore an archived entity within a transaction. Returns the mapped result.
 *
 * The mapper receives the raw Drizzle row; callers should pass their existing
 * typed mapper (e.g. `toCustomFrontResult`) which will receive the correctly
 * shaped row at runtime from `.returning()`.
 */
export async function restoreEntity<TResult>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: ArchivableEntityConfig,
  toResult: (row: Record<string, unknown>) => TResult,
): Promise<TResult> {
  await assertSystemOwnership(db, systemId, auth);

  const timestamp = now();
  const { table, columns, entityName, restoreEvent } = cfg;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: columns.id })
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

    const updated = await tx
      .update(table)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)))
      .returning();

    const row = updated[0];
    if (!row) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Archived ${entityName.toLowerCase()} not found`,
      );
    }

    await audit(tx, {
      eventType: restoreEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} restored`,
      systemId,
    });

    return toResult(row);
  });
}
