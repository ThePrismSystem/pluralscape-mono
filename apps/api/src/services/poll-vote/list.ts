import { polls, pollVotes } from "@pluralscape/db/pg";
import { PollVoteQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toVoteResult } from "./internal.js";

import type { PollVoteResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PaginatedResult, PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListVoteOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export async function listVotes(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  opts: ListVoteOpts = {},
): Promise<PaginatedResult<PollVoteResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify poll exists
    const pollArchiveConditions = opts.includeArchived ? [] : [eq(polls.archived, false)];
    const [poll] = await tx
      .select({ id: polls.id })
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), ...pollArchiveConditions))
      .limit(1);
    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    const conditions = [eq(pollVotes.pollId, pollId), eq(pollVotes.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(pollVotes.archived, false));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "vote");
      const cursorCondition = or(
        lt(pollVotes.createdAt, decoded.sortValue),
        and(eq(pollVotes.createdAt, decoded.sortValue), lt(pollVotes.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(pollVotes)
      .where(and(...conditions))
      .orderBy(desc(pollVotes.createdAt), desc(pollVotes.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toVoteResult, (i) => i.createdAt);
  });
}

export function parsePollVoteQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
} {
  return parseQuery(PollVoteQuerySchema, query);
}
