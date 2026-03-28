import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";

import { assertAccountOwnership } from "./account-ownership.js";
import { ApiHttpError } from "./api-error.js";
import { withAccountTransaction, withTenantTransaction } from "./rls-context.js";
import { assertSystemOwnership } from "./system-ownership.js";

import type { AuditWriter } from "./audit-writer.js";
import type { AuthContext } from "./auth-context.js";
import type { AccountId, AuditEventType, SystemId } from "@pluralscape/types";
import type { ColumnBaseConfig, ColumnDataType } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type AnyPgColumn = PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object>;

/** Shared column references for all archive/restore operations. */
interface BaseArchivableColumns {
  readonly id: AnyPgColumn;
  readonly archived: AnyPgColumn;
  readonly archivedAt: AnyPgColumn;
  readonly updatedAt: AnyPgColumn;
  readonly version: AnyPgColumn;
}

/** Column references needed for archive/restore operations (system-scoped). */
export interface ArchivableColumns extends BaseArchivableColumns {
  readonly systemId: AnyPgColumn;
}

/** Column references needed for archive/restore operations (account-scoped). */
export interface AccountArchivableColumns extends BaseArchivableColumns {
  readonly accountId: AnyPgColumn;
}

/** Shared configuration for all archivable entities. */
interface BaseArchivableEntityConfig {
  readonly table: PgTable;
  readonly entityName: string;
  readonly archiveEvent: AuditEventType;
  readonly restoreEvent: AuditEventType;
}

/** Configuration for a generic archivable entity (system-scoped). */
export interface ArchivableEntityConfig<TId extends string> extends BaseArchivableEntityConfig {
  readonly columns: ArchivableColumns;
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

/** Configuration for an archivable entity scoped to an account (not a system). */
export interface AccountArchivableEntityConfig<
  TId extends string,
> extends BaseArchivableEntityConfig {
  readonly columns: AccountArchivableColumns;
  /** Optional hook called inside the transaction after a successful archive + audit. */
  readonly onArchive?: (
    tx: PostgresJsDatabase,
    accountId: AccountId,
    entityId: TId,
  ) => Promise<unknown>;
  /** Optional hook called inside the transaction after a successful restore + audit. */
  readonly onRestore?: (
    tx: PostgresJsDatabase,
    accountId: AccountId,
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

// ── Account-scoped Archive / Restore ────────────────────────────

/**
 * Archive an account-scoped entity by setting archived=true within a transaction.
 *
 * Uses `withAccountTransaction` and `assertAccountOwnership` instead of the
 * system-scoped equivalents. Scoping column is `accountId` rather than `systemId`.
 */
export async function archiveAccountEntity<TId extends string>(
  db: PostgresJsDatabase,
  accountId: AccountId,
  entityId: TId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: AccountArchivableEntityConfig<TId>,
): Promise<void> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();
  const { table, columns, entityName, archiveEvent } = cfg;

  await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(table)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(
        and(
          eq(columns.id, entityId),
          eq(columns.accountId, accountId),
          eq(columns.archived, false),
        ),
      )
      .returning({ id: columns.id });

    if (updated.length === 0) {
      const existing = await tx
        .select({ id: columns.id })
        .from(table)
        .where(and(eq(columns.id, entityId), eq(columns.accountId, accountId)));

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
      accountId,
    });

    if (cfg.onArchive) {
      await cfg.onArchive(tx, accountId, entityId);
    }
  });
}

/**
 * Restore an archived account-scoped entity within a transaction.
 *
 * Uses `withAccountTransaction` and `assertAccountOwnership` instead of the
 * system-scoped equivalents. Scoping column is `accountId` rather than `systemId`.
 *
 * The `toResult` mapper receives the raw Drizzle row from `.returning()`;
 * callers should pass their existing typed mapper (e.g. `toFriendConnectionResult`).
 */
export async function restoreAccountEntity<TId extends string, TResult>(
  db: PostgresJsDatabase,
  accountId: AccountId,
  entityId: TId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: AccountArchivableEntityConfig<TId>,
  toResult: (row: Record<string, unknown>) => TResult,
): Promise<TResult> {
  assertAccountOwnership(accountId, auth);

  const timestamp = now();
  const { table, columns, entityName, restoreEvent } = cfg;

  return withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(table)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${columns.version} + 1`,
      } as Record<string, unknown>)
      .where(
        and(eq(columns.id, entityId), eq(columns.accountId, accountId), eq(columns.archived, true)),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const existing = await tx
        .select({ id: columns.id })
        .from(table)
        .where(and(eq(columns.id, entityId), eq(columns.accountId, accountId)));

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
      accountId,
    });

    if (cfg.onRestore) {
      await cfg.onRestore(tx, accountId, entityId);
    }

    return toResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

/** Column references needed for delete operations. */
export interface DeletableColumns {
  readonly id: AnyPgColumn;
  readonly systemId: AnyPgColumn;
  readonly archived: AnyPgColumn;
}

/** Configuration for a generic deletable entity. */
export interface DeletableEntityConfig<TId extends string> {
  readonly table: PgTable;
  readonly columns: DeletableColumns;
  readonly entityName: string;
  readonly deleteEvent: AuditEventType;
  /** Optional hook called inside the transaction after audit (e.g., webhook dispatch). */
  readonly onDelete?: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
  ) => Promise<unknown>;
  /** Optional: check for dependents before deleting (throws on conflict). */
  readonly checkDependents?: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
  ) => Promise<void>;
}

/**
 * Delete a non-archived entity within a transaction.
 *
 * 1. Checks the entity exists and is not archived.
 * 2. Optionally checks for dependents (e.g., poll with votes).
 * 3. Writes an audit event and calls the optional onDelete hook.
 * 4. Hard-deletes the row.
 */
export async function deleteEntity<TId extends string>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: TId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: DeletableEntityConfig<TId>,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const { table, columns, entityName, deleteEvent } = cfg;

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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

    if (cfg.checkDependents) {
      await cfg.checkDependents(tx, systemId, entityId);
    }

    await audit(tx, {
      eventType: deleteEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: `${entityName} deleted`,
      systemId,
    });

    if (cfg.onDelete) {
      await cfg.onDelete(tx, systemId, entityId);
    }

    await tx.delete(table).where(and(eq(columns.id, entityId), eq(columns.systemId, systemId)));
  });
}
