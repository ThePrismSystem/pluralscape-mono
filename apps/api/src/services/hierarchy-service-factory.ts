import { createId, now } from "@pluralscape/types";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  AuditEventType,
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { ColumnBaseConfig, ColumnDataType } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

// ── Type helpers ───────────────────────────────────────────────────

type AnyPgColumn = PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object>;

/** Minimum column set for a hierarchical entity table. */
export interface HierarchyColumns {
  readonly id: AnyPgColumn;
  readonly systemId: AnyPgColumn;
  readonly parentId: AnyPgColumn;
  readonly encryptedData: AnyPgColumn;
  readonly version: AnyPgColumn;
  readonly archived: AnyPgColumn;
  readonly archivedAt: AnyPgColumn;
  readonly createdAt: AnyPgColumn;
  readonly updatedAt: AnyPgColumn;
}

/** A single dependent-table check for the delete guard. */
export interface DependentCheck {
  readonly table: PgTable;
  /** Column on the dependent table that references the entity being deleted. */
  readonly entityColumn: AnyPgColumn;
  /** Column on the dependent table that references the system. */
  readonly systemColumn: AnyPgColumn;
  /** Human-readable label for error messages. */
  readonly label: string;
  /**
   * Whether this check filters on archived=false. True for child entity checks
   * (only active children block delete), false for junction/link tables.
   */
  readonly filterArchived?: AnyPgColumn;
}

/** Configuration for the hierarchy service factory. */
export interface HierarchyServiceConfig<
  TRow extends Record<string, unknown>,
  TResult extends { readonly id: string },
> {
  /** The Drizzle table reference. */
  readonly table: PgTable;
  /** Column references mapped to generic hierarchy names. */
  readonly columns: HierarchyColumns;
  /** ID prefix for new entities (e.g. ID_PREFIXES.group). */
  readonly idPrefix: string;
  /** Human-readable entity name for error messages. */
  readonly entityName: string;
  /** The camelCase field name for the parent ID in parsed bodies and insert values (e.g. "parentGroupId"). */
  readonly parentFieldName: string;
  /** Maps a raw DB row to the domain result type. */
  readonly toResult: (row: TRow) => TResult;
  /** Zod schema for create body validation. */
  readonly createSchema: z.ZodType<{ encryptedData: string }>;
  /** Zod schema for update body validation. */
  readonly updateSchema: z.ZodType<{ encryptedData: string; version: number }>;
  /** Additional insert values derived from the parsed create body. */
  readonly createInsertValues: (parsed: Record<string, unknown>) => Record<string, unknown>;
  /** Additional set values derived from the parsed update body. */
  readonly updateSetValues: (parsed: Record<string, unknown>) => Record<string, unknown>;
  /** Dependent tables/columns checked before delete (409 pattern). */
  readonly dependentChecks: readonly DependentCheck[];
  /** Audit event type strings. */
  readonly events: {
    readonly created: AuditEventType;
    readonly updated: AuditEventType;
    readonly deleted: AuditEventType;
    readonly archived: AuditEventType;
    readonly restored: AuditEventType;
  };
  /**
   * Pre-update hook for cycle detection and extra validation.
   * Called inside the transaction before the OCC update.
   */
  readonly beforeUpdate?: (
    tx: PostgresJsDatabase,
    entityId: string,
    parsed: Record<string, unknown>,
    systemId: SystemId,
  ) => Promise<void>;
}

// ── Base result type ───────────────────────────────────────────────

/** Fields common to all hierarchy entity results. */
export interface BaseHierarchyResult {
  readonly id: string;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

/** Maps base columns shared by all hierarchy entities. */
export function mapBaseFields(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): BaseHierarchyResult {
  return {
    id: row.id,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

// ── Factory ────────────────────────────────────────────────────────

export interface HierarchyService<TId extends string, TResult extends { readonly id: string }> {
  readonly create: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    params: unknown,
    auth: AuthContext,
    audit: AuditWriter,
  ) => Promise<TResult>;

  readonly list: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    auth: AuthContext,
    cursor?: PaginationCursor,
    limit?: number,
  ) => Promise<PaginatedResult<TResult>>;

  readonly get: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
  ) => Promise<TResult>;

  readonly update: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    params: unknown,
    auth: AuthContext,
    audit: AuditWriter,
  ) => Promise<TResult>;

  readonly remove: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ) => Promise<void>;

  readonly archive: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ) => Promise<void>;

  readonly restore: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ) => Promise<TResult>;
}

/** Create a hierarchy service with standard CRUD, archive, and restore operations. */
export function createHierarchyService<
  TRow extends Record<string, unknown>,
  TId extends string,
  TResult extends { readonly id: string },
>(cfg: HierarchyServiceConfig<TRow, TResult>): HierarchyService<TId, TResult> {
  const {
    table,
    columns,
    idPrefix,
    entityName,
    parentFieldName,
    toResult,
    events,
    dependentChecks,
  } = cfg;

  const lifecycleCfg: ArchivableEntityConfig = {
    table,
    columns: {
      id: columns.id,
      systemId: columns.systemId,
      archived: columns.archived,
      archivedAt: columns.archivedAt,
      updatedAt: columns.updatedAt,
      version: columns.version,
    },
    entityName,
    archiveEvent: events.archived,
    restoreEvent: events.restored,
  };

  // ── CREATE ────────────────────────────────────────────────────────

  async function create(
    db: PostgresJsDatabase,
    systemId: SystemId,
    params: unknown,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    assertSystemOwnership(systemId, auth);

    const { parsed, blob } = parseAndValidateBlob(
      params,
      cfg.createSchema,
      MAX_ENCRYPTED_DATA_BYTES,
    );

    const entityId = createId(idPrefix);
    const timestamp = now();

    return db.transaction(async (tx) => {
      // Validate parent exists in same system if non-null
      const parsedRecord = parsed as Record<string, unknown>;
      const rawParentId = parentFieldName in parsedRecord ? parsedRecord[parentFieldName] : null;
      const parentId = typeof rawParentId === "string" ? rawParentId : null;
      if (parentId !== null) {
        const [parent] = await tx
          .select({ id: columns.id })
          .from(table)
          .where(
            and(
              eq(columns.id, parentId),
              eq(columns.systemId, systemId),
              eq(columns.archived, false),
            ),
          )
          .limit(1);

        if (!parent) {
          throw new ApiHttpError(
            HTTP_NOT_FOUND,
            "NOT_FOUND",
            `Parent ${entityName.toLowerCase()} not found`,
          );
        }
      }

      const extraValues = cfg.createInsertValues(parsed as Record<string, unknown>);

      const [row] = await tx
        .insert(table)
        .values({
          id: entityId,
          systemId,
          [parentFieldName]: parentId ?? null,
          encryptedData: blob,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...extraValues,
        } as Record<string, unknown>)
        .returning();

      if (!row) {
        throw new Error(`Failed to create ${entityName.toLowerCase()} — INSERT returned no rows`);
      }

      await audit(tx, {
        eventType: events.created,
        actor: { kind: "account", id: auth.accountId },
        detail: `${entityName} created`,
        systemId,
      });

      return toResult(row as TRow);
    });
  }

  // ── LIST ──────────────────────────────────────────────────────────

  async function list(
    db: PostgresJsDatabase,
    systemId: SystemId,
    auth: AuthContext,
    cursor?: PaginationCursor,
    limit = DEFAULT_PAGE_LIMIT,
  ): Promise<PaginatedResult<TResult>> {
    assertSystemOwnership(systemId, auth);

    const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

    const conditions = [eq(columns.systemId, systemId), eq(columns.archived, false)];

    if (cursor) {
      conditions.push(gt(columns.id, cursor));
    }

    const rows = await db
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(columns.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, (row) => toResult(row as TRow));
  }

  // ── GET ───────────────────────────────────────────────────────────

  async function get(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
  ): Promise<TResult> {
    assertSystemOwnership(systemId, auth);

    const [row] = await db
      .select()
      .from(table)
      .where(
        and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, false)),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
    }

    return toResult(row as TRow);
  }

  // ── UPDATE ────────────────────────────────────────────────────────

  async function update(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    params: unknown,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    assertSystemOwnership(systemId, auth);

    const { parsed, blob } = parseAndValidateBlob(
      params,
      cfg.updateSchema,
      MAX_ENCRYPTED_DATA_BYTES,
    );

    const timestamp = now();
    const parsedRecord = parsed as Record<string, unknown>;

    return db.transaction(async (tx) => {
      if (cfg.beforeUpdate) {
        await cfg.beforeUpdate(tx, entityId, parsedRecord, systemId);
      }

      const extraValues = cfg.updateSetValues(parsedRecord);

      const updated = await tx
        .update(table)
        .set({
          encryptedData: blob,
          updatedAt: timestamp,
          version: sql`${columns.version} + 1`,
          ...extraValues,
        } as Record<string, unknown>)
        .where(
          and(
            eq(columns.id, entityId),
            eq(columns.systemId, systemId),
            eq(columns.version, parsedRecord.version as number),
            eq(columns.archived, false),
          ),
        )
        .returning();

      const row = await assertOccUpdated(
        updated,
        async () => {
          const [existing] = await tx
            .select({ id: columns.id })
            .from(table)
            .where(
              and(
                eq(columns.id, entityId),
                eq(columns.systemId, systemId),
                eq(columns.archived, false),
              ),
            )
            .limit(1);
          return existing;
        },
        entityName,
      );

      await audit(tx, {
        eventType: events.updated,
        actor: { kind: "account", id: auth.accountId },
        detail: `${entityName} updated`,
        systemId,
      });

      return toResult(row as TRow);
    });
  }

  // ── DELETE ────────────────────────────────────────────────────────

  async function remove(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<void> {
    assertSystemOwnership(systemId, auth);

    await db.transaction(async (tx) => {
      // Verify entity exists
      const [existing] = await tx
        .select({ id: columns.id })
        .from(table)
        .where(
          and(
            eq(columns.id, entityId),
            eq(columns.systemId, systemId),
            eq(columns.archived, false),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
      }

      // Check dependents
      await checkDependents(tx, entityId, systemId);

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

  // ── ARCHIVE ───────────────────────────────────────────────────────

  async function archive(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<void> {
    await archiveEntity(db, systemId, entityId, auth, audit, lifecycleCfg);
  }

  // ── RESTORE ───────────────────────────────────────────────────────

  async function restore(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    assertSystemOwnership(systemId, auth);

    const timestamp = now();

    return db.transaction(async (tx) => {
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

  // ── Internal helpers ──────────────────────────────────────────────

  async function checkDependents(
    tx: PostgresJsDatabase,
    entityId: string,
    systemId: SystemId,
  ): Promise<void> {
    if (dependentChecks.length === 0) return;

    const results = await Promise.all(
      dependentChecks.map((dep) => {
        const conditions = [eq(dep.entityColumn, entityId), eq(dep.systemColumn, systemId)];

        if (dep.filterArchived) {
          conditions.push(eq(dep.filterArchived, false));
        }

        return tx
          .select({ count: count() })
          .from(dep.table)
          .where(and(...conditions));
      }),
    );

    const counts: { label: string; count: number }[] = [];
    results.forEach((rows, i) => {
      const dep = dependentChecks[i];
      if (!dep) {
        throw new Error("Unexpected: results/dependentChecks length mismatch");
      }
      const [result] = rows;
      if (!result) {
        throw new Error("Unexpected: count query returned no rows");
      }
      if (result.count > 0) {
        counts.push({ label: dep.label, count: result.count });
      }
    });

    if (counts.length > 0) {
      const parts = counts.map((c) => `${String(c.count)} ${c.label}`);
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `${entityName} has ${parts.join(" and ")}. Remove all dependents before deleting.`,
      );
    }
  }

  return { create, list, get, update, remove, archive, restore };
}
