import {
  type SQLiteColumn,
  index,
  type IndexBuilder,
  unique,
  type UniqueConstraintBuilder,
} from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob } from "../columns/sqlite.js";
import { systems } from "../schema/sqlite/systems.js";

import { archivableConsistencyCheckFor, versionCheckFor } from "./audit.sqlite.js";

import type { AnyBrandedId, SystemId } from "@pluralscape/types";
import type { check } from "drizzle-orm/sqlite-core";

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
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
  };
}

/**
 * Branded-id PK + systemId FK to systems. Used by every system-scoped
 * entity. Shared between server-encrypted and client-cache schemas so
 * the structural identity columns are literally the same builders.
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
 * Server-side encrypted-payload column. Used only by the encrypted
 * variants in `schema/pg/` and `schema/sqlite/`. The cache variant
 * has decrypted fields instead.
 */
export function encryptedPayload(): ReturnType<typeof _encryptedPayload> {
  return _encryptedPayload();
}

/**
 * Indexes shared by both server-encrypted and client-cache schemas
 * for system-scoped archivable entities. Names are derived from
 * `tableName` so the cache mirror produces identical structural
 * names where it shadows server schemas.
 */
export function commonEntityIndexes(
  tableName: string,
  t: {
    id: SQLiteColumn;
    systemId: SQLiteColumn;
    archived: SQLiteColumn;
    createdAt: SQLiteColumn;
  },
): [IndexBuilder, IndexBuilder, UniqueConstraintBuilder] {
  return [
    index(`${tableName}_system_id_archived_idx`).on(t.systemId, t.archived),
    index(`${tableName}_created_at_idx`).on(t.createdAt),
    unique(`${tableName}_id_system_id_unique`).on(t.id, t.systemId),
  ];
}

/**
 * Server-only DB constraints. The client-cache schema doesn't need
 * these because the materializer is the sole writer and CRDT semantics
 * enforce invariants upstream.
 */
export function serverEntityChecks(
  tableName: string,
  t: {
    version: SQLiteColumn;
    archived: SQLiteColumn;
    archivedAt: SQLiteColumn;
  },
): [ReturnType<typeof check>, ReturnType<typeof check>] {
  return [
    versionCheckFor(tableName, t.version),
    archivableConsistencyCheckFor(tableName, t.archived, t.archivedAt),
  ];
}
