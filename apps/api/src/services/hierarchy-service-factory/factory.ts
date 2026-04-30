import { archiveEntity } from "../../lib/entity-lifecycle.js";

import { createEntity } from "./create-op.js";
import { getEntity, listEntities } from "./query-ops.js";
import { removeEntity } from "./remove-op.js";
import { restoreEntity } from "./restore-op.js";
import { updateEntity } from "./update-op.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type {
  HierarchyCreateBody,
  HierarchyService,
  HierarchyServiceConfig,
  HierarchyUpdateBody,
} from "../hierarchy-service-types.js";
import type { PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Create a hierarchy service with standard CRUD, archive, and restore operations. */
export function createHierarchyService<
  TRow extends Record<string, unknown>,
  TId extends string,
  TResult extends { readonly id: string },
  TCreateBody extends HierarchyCreateBody,
  TUpdateBody extends HierarchyUpdateBody,
>(
  cfg: HierarchyServiceConfig<TRow, TResult, TCreateBody, TUpdateBody>,
): HierarchyService<TId, TResult, TCreateBody, TUpdateBody> {
  const { table, columns, entityName, events } = cfg;

  const lifecycleCfg: ArchivableEntityConfig<TId> = {
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

  async function create(
    db: PostgresJsDatabase,
    systemId: SystemId,
    body: TCreateBody,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    return createEntity(cfg, db, systemId, body, auth, audit);
  }

  async function list(
    db: PostgresJsDatabase,
    systemId: SystemId,
    auth: AuthContext,
    cursor?: string,
    limit?: number,
    includeArchived?: boolean,
  ): Promise<PaginatedResult<TResult>> {
    return listEntities(cfg, db, systemId, auth, cursor, limit, includeArchived);
  }

  async function get(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
  ): Promise<TResult> {
    return getEntity(cfg, db, systemId, entityId, auth);
  }

  async function update(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    body: TUpdateBody,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    return updateEntity(cfg, db, systemId, entityId, body, auth, audit);
  }

  async function remove(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<void> {
    return removeEntity(cfg, db, systemId, entityId, auth, audit);
  }

  async function archive(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<void> {
    await archiveEntity(db, systemId, entityId, auth, audit, lifecycleCfg);
  }

  async function restore(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
    audit: AuditWriter,
  ): Promise<TResult> {
    return restoreEntity(cfg, db, systemId, entityId, auth, audit);
  }

  return { create, list, get, update, remove, archive, restore };
}
