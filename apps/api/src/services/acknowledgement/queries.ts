import { acknowledgements } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { AcknowledgementQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toAcknowledgementResult, type AcknowledgementResult } from "./internal.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AcknowledgementId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListAcknowledgementOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly confirmed?: boolean;
}

export async function getAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(acknowledgements)
      .where(
        and(
          eq(acknowledgements.id, ackId),
          eq(acknowledgements.systemId, systemId),
          eq(acknowledgements.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Acknowledgement not found");
    }

    return toAcknowledgementResult(row);
  });
}

export async function listAcknowledgements(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListAcknowledgementOpts = {},
): Promise<PaginatedResult<AcknowledgementResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(acknowledgements.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(acknowledgements.archived, false));
    }

    if (opts.confirmed !== undefined) {
      conditions.push(eq(acknowledgements.confirmed, opts.confirmed));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "ack");
      const cursorCondition = or(
        lt(acknowledgements.createdAt, decoded.sortValue),
        and(
          eq(acknowledgements.createdAt, decoded.sortValue),
          lt(acknowledgements.id, brandId<AcknowledgementId>(decoded.id)),
        ),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(acknowledgements)
      .where(and(...conditions))
      .orderBy(desc(acknowledgements.createdAt), desc(acknowledgements.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toAcknowledgementResult,
      (i) => i.createdAt,
    );
  });
}

export function parseAcknowledgementQuery(query: Record<string, string | undefined>): {
  confirmed?: boolean;
  includeArchived: boolean;
} {
  return parseQuery(AcknowledgementQuerySchema, query);
}
