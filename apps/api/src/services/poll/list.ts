import { polls } from "@pluralscape/db/pg";
import { PollQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toPollResult } from "./internal.js";

import type { ListPollOpts, PollResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PaginatedResult, PollStatus, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listPolls(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListPollOpts = {},
): Promise<PaginatedResult<PollResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(polls.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(polls.archived, false));
    }

    if (opts.status !== undefined) {
      conditions.push(eq(polls.status, opts.status));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "poll");
      const cursorCondition = or(
        lt(polls.createdAt, decoded.sortValue),
        and(eq(polls.createdAt, decoded.sortValue), lt(polls.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(polls)
      .where(and(...conditions))
      .orderBy(desc(polls.createdAt), desc(polls.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toPollResult, (i) => i.createdAt);
  });
}

export function parsePollQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  status?: PollStatus;
} {
  return parseQuery(PollQuerySchema, query);
}
