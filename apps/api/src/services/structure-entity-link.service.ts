import { systemStructureEntityLinks } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateStructureEntityLinkBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityLinkResult {
  readonly id: SystemStructureEntityLinkId;
  readonly systemId: SystemId;
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

// ── Row mapper ────────────────────────────────────────────────────

function toEntityLinkResult(row: {
  id: string;
  systemId: string;
  entityId: string;
  parentEntityId: string | null;
  sortOrder: number;
  createdAt: number;
}): EntityLinkResult {
  return {
    id: row.id as SystemStructureEntityLinkId,
    systemId: row.systemId as SystemId,
    entityId: row.entityId as SystemStructureEntityId,
    parentEntityId: row.parentEntityId as SystemStructureEntityId | null,
    sortOrder: row.sortOrder,
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ════════════════════════════════════════════════════════════════════
// Entity Links (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const linkId = createId(ID_PREFIXES.structureEntityLink);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityLinks)
      .values({
        id: linkId,
        systemId,
        entityId: parsed.data.entityId,
        parentEntityId: parsed.data.parentEntityId,
        sortOrder: parsed.data.sortOrder,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity link — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-link.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link created",
      systemId,
    });

    return toEntityLinkResult(row);
  });
}

export async function listEntityLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityLinkResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = opts?.limit ?? DEFAULT_PAGE_LIMIT;

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityLinks.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityLinks.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityLinks)
      .where(and(...conditions))
      .orderBy(systemStructureEntityLinks.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityLinkResult);
  });
}

export async function deleteEntityLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityLinks.id })
      .from(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkId),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity link not found");
    }

    await audit(tx, {
      eventType: "structure-entity-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity link deleted",
      systemId,
    });

    await tx
      .delete(systemStructureEntityLinks)
      .where(
        and(
          eq(systemStructureEntityLinks.id, linkId),
          eq(systemStructureEntityLinks.systemId, systemId),
        ),
      );
  });
}
