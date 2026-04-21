import { boardMessages } from "@pluralscape/db/pg";
import { BoardMessageQuerySchema } from "@pluralscape/validation";
import { and, eq, gt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toBoardMessageResult } from "./internal.js";

import type { BoardMessageResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BoardMessageId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListBoardMessageOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly pinned?: boolean;
}

export async function listBoardMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListBoardMessageOpts = {},
): Promise<PaginatedResult<BoardMessageResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(boardMessages.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(boardMessages.archived, false));
    }

    if (opts.pinned !== undefined) {
      conditions.push(eq(boardMessages.pinned, opts.pinned));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "board message");
      const cursorCondition = or(
        gt(boardMessages.sortOrder, decoded.sortValue),
        and(eq(boardMessages.sortOrder, decoded.sortValue), gt(boardMessages.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(boardMessages)
      .where(and(...conditions))
      .orderBy(boardMessages.sortOrder, boardMessages.id)
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toBoardMessageResult,
      (i) => i.sortOrder,
    );
  });
}

export async function getBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(boardMessages)
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    return toBoardMessageResult(row);
  });
}

export function parseBoardMessageQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  pinned?: boolean;
} {
  return parseQuery(BoardMessageQuerySchema, query);
}
