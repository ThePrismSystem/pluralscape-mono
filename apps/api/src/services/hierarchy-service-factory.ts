import { createId, now } from "@pluralscape/types";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { checkDependents } from "./hierarchy-service-helpers.js";

import type { HierarchyService, HierarchyServiceConfig } from "./hierarchy-service-types.js";
import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../lib/entity-lifecycle.js";
import type { PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Factory ────────────────────────────────────────────────────────

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

    return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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
    cursor?: string,
    limit = DEFAULT_PAGE_LIMIT,
  ): Promise<PaginatedResult<TResult>> {
    assertSystemOwnership(systemId, auth);

    const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

    return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
      const conditions = [eq(columns.systemId, systemId), eq(columns.archived, false)];

      if (cursor) {
        conditions.push(gt(columns.id, cursor));
      }

      const rows = await tx
        .select()
        .from(table)
        .where(and(...conditions))
        .orderBy(columns.id)
        .limit(effectiveLimit + 1);

      return buildPaginatedResult(rows, effectiveLimit, (row) => toResult(row as TRow));
    });
  }

  // ── GET ───────────────────────────────────────────────────────────

  async function get(
    db: PostgresJsDatabase,
    systemId: SystemId,
    entityId: TId,
    auth: AuthContext,
  ): Promise<TResult> {
    assertSystemOwnership(systemId, auth);

    return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(columns.id, entityId),
            eq(columns.systemId, systemId),
            eq(columns.archived, false),
          ),
        )
        .limit(1);

      if (!row) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
      }

      return toResult(row as TRow);
    });
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

    return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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

    await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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
      await checkDependents(tx, entityId, systemId, entityName, dependentChecks);

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

    return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
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

  return { create, list, get, update, remove, archive, restore };
}
