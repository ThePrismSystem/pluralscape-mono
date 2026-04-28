import {
  type ExtraConfigColumn,
  type IndexBuilder,
  type PgColumn,
  type UniqueConstraintBuilder,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../columns/pg.js";
import { systems } from "../schema/pg/systems.js";

import { archivableConsistencyCheckFor, versionCheckFor } from "./audit.pg.js";

import type { AnyBrandedId, SystemId } from "@pluralscape/types";
import type { check } from "drizzle-orm/pg-core";

function _entityIdentity<TIdBrand extends AnyBrandedId>() {
  return {
    id: brandedId<TIdBrand>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
  };
}

function _encryptedPayload() {
  return {
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
  };
}

/**
 * Branded-id PK + systemId FK to systems. Used by every system-scoped
 * entity. PG dialect mirror of the SQLite mixin so server-encrypted
 * tables across both dialects use the same structural builders.
 *
 * Carve-out: `system` itself does not use this (it has no systemId).
 * Entities with non-system parent FKs (member-photo → member, etc.)
 * write their own identity columns and document the deviation.
 *
 * See ADR-038 for the broader three-schema-set context.
 */
export function entityIdentity<TIdBrand extends AnyBrandedId>(): ReturnType<
  typeof _entityIdentity<TIdBrand>
> {
  return _entityIdentity<TIdBrand>();
}

/**
 * Server-side encrypted-payload column. PG bytea variant; matches the
 * SQLite blob variant in shape and constraints.
 */
export function encryptedPayload(): ReturnType<typeof _encryptedPayload> {
  return _encryptedPayload();
}

/**
 * Indexes shared by every system-scoped archivable PG entity. Names
 * mirror the SQLite counterpart so dialect parity tests pass without
 * special-casing.
 */
export function commonEntityIndexes(
  tableName: string,
  t: {
    id: ExtraConfigColumn;
    systemId: ExtraConfigColumn;
    archived: ExtraConfigColumn;
    createdAt: ExtraConfigColumn;
  },
): [IndexBuilder, IndexBuilder, UniqueConstraintBuilder] {
  return [
    index(`${tableName}_system_id_archived_idx`).on(t.systemId, t.archived),
    index(`${tableName}_created_at_idx`).on(t.createdAt),
    unique(`${tableName}_id_system_id_unique`).on(t.id, t.systemId),
  ];
}

/**
 * Server-only DB constraints. PG mirror of the SQLite mixin.
 */
export function serverEntityChecks(
  tableName: string,
  t: {
    version: PgColumn;
    archived: PgColumn;
    archivedAt: PgColumn;
  },
): [ReturnType<typeof check>, ReturnType<typeof check>] {
  return [
    versionCheckFor(tableName, t.version),
    archivableConsistencyCheckFor(tableName, t.archived, t.archivedAt),
  ];
}
