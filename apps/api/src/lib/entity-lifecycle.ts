import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";
import { withTenantTransaction } from "./rls-context.js";
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
export interface ArchivableEntityConfig<TId extends string = string> {
  readonly table: PgTable;
  readonly columns: ArchivableColumns;
  readonly entityName: string;
  readonly archiveEvent: AuditEventType;
  readonly restoreEvent: AuditEventType;
  /** Optional hook called inside the transaction after a successful archive + audit. */
  readonly onArchive?: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
  ) => Promise<unknown>;
  /** Optional hook called inside the transaction after a successful restore + audit. */
  readonly onRestore?: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
  ) => Promise<unknown>;
}

/**
 * Archive an entity by setting archived=true within a transaction.
 *
 * The `.set()` object uses `as Record<string, unknown>` to satisfy Drizzle's
 * generic table types. The expected column names at runtime are:
 * `archived`, `archivedAt`, `updatedAt`, `version`.
 */
export async function archiveEntity<TId extends string>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: TId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: ArchivableEntityConfig<TId>,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();
  const { table, columns, entityName, archiveEvent } = cfg;

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const updated = await tx
      .update(table)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, false)),
      )
      .returning({ id: columns.id });

    if (updated.length === 0) {
      const existing = await tx
        .select({ id: columns.id })
        .from(table)
        .where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)));

      if (existing.length > 0) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          `${entityName} is already archived`,
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
    }

    await audit(tx, {
      eventType: archiveEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} archived`,
      systemId,
    });

    if (cfg.onArchive) {
      await cfg.onArchive(tx, systemId, entityId);
    }
  });
}

/**
 * Restore an archived entity within a transaction. Returns the mapped result.
 *
 * The mapper receives the raw Drizzle row; callers should pass their existing
 * typed mapper (e.g. `toCustomFrontResult`) which will receive the correctly
 * shaped row at runtime from `.returning()`.
 *
 * The `.set()` object uses `as Record<string, unknown>` to satisfy Drizzle's
 * generic table types. The expected column names at runtime are:
 * `archived`, `archivedAt`, `updatedAt`, `version`.
 */
export async function restoreEntity<TId extends string, TResult>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: TId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: ArchivableEntityConfig<TId>,
  toResult: (row: Record<string, unknown>) => TResult,
): Promise<TResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();
  const { table, columns, entityName, restoreEvent } = cfg;

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const updated = await tx
      .update(table)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, true)),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const existing = await tx
        .select({ id: columns.id })
        .from(table)
        .where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)));

      if (existing.length > 0) {
        throw new ApiHttpError(HTTP_CONFLICT, "NOT_ARCHIVED", `${entityName} is not archived`);
      }
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

    if (cfg.onRestore) {
      await cfg.onRestore(tx, systemId, entityId);
    }

    return toResult(row);
  });
}
