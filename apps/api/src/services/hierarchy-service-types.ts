import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { AuditEventType, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
import type { ColumnBaseConfig, ColumnDataType } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

// ── Type helpers ───────────────────────────────────────────────────

export type AnyPgColumn = PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object>;

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
   * Optional column reference for archive filtering. When provided, adds an
   * `= false` condition to exclude archived rows. Use for child entity checks
   * (only active children block delete); omit for junction/link tables.
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

// ── Service interface ──────────────────────────────────────────────

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
    cursor?: string,
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
