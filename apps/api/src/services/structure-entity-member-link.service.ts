import { systemStructureEntityMemberLinks } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateStructureEntityMemberLinkBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  MemberId,
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityMemberLinkId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Result types ───────────────────────────────────────────────────

export interface EntityMemberLinkResult {
  readonly id: SystemStructureEntityMemberLinkId;
  readonly systemId: SystemId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly memberId: MemberId;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

// ── Row mapper ────────────────────────────────────────────────────

function toEntityMemberLinkResult(row: {
  id: string;
  systemId: string;
  parentEntityId: string | null;
  memberId: string;
  sortOrder: number;
  createdAt: number;
}): EntityMemberLinkResult {
  return {
    id: brandId<SystemStructureEntityMemberLinkId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    parentEntityId: row.parentEntityId
      ? brandId<SystemStructureEntityId>(row.parentEntityId)
      : null,
    memberId: brandId<MemberId>(row.memberId),
    sortOrder: row.sortOrder,
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ════════════════════════════════════════════════════════════════════
// Entity Member Links (junction)
// ════════════════════════════════════════════════════════════════════

export async function createEntityMemberLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityMemberLinkResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityMemberLinkBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const linkId = createId(ID_PREFIXES.structureEntityMemberLink);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityMemberLinks)
      .values({
        id: linkId,
        systemId,
        parentEntityId: parsed.data.parentEntityId,
        memberId: parsed.data.memberId,
        sortOrder: parsed.data.sortOrder,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity member link — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-member-link.added",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity member link added",
      systemId,
    });

    return toEntityMemberLinkResult(row);
  });
}

export async function listEntityMemberLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
  },
): Promise<PaginatedResult<EntityMemberLinkResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemStructureEntityMemberLinks.systemId, systemId)];

    if (opts?.cursor) {
      conditions.push(gt(systemStructureEntityMemberLinks.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(systemStructureEntityMemberLinks)
      .where(and(...conditions))
      .orderBy(systemStructureEntityMemberLinks.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toEntityMemberLinkResult);
  });
}

export async function deleteEntityMemberLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: systemStructureEntityMemberLinks.id })
      .from(systemStructureEntityMemberLinks)
      .where(
        and(
          eq(systemStructureEntityMemberLinks.id, linkId),
          eq(systemStructureEntityMemberLinks.systemId, systemId),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity member link not found");
    }

    await audit(tx, {
      eventType: "structure-entity-member-link.removed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity member link removed",
      systemId,
    });

    await tx
      .delete(systemStructureEntityMemberLinks)
      .where(
        and(
          eq(systemStructureEntityMemberLinks.id, linkId),
          eq(systemStructureEntityMemberLinks.systemId, systemId),
        ),
      );
  });
}
