import { polls, pollVotes } from "@pluralscape/db/pg";
import { and, count, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface PollResultsOptionCount {
  readonly optionId: string | null;
  readonly count: number;
}

export interface PollResults {
  readonly pollId: PollId;
  readonly totalVotes: number;
  readonly vetoCount: number;
  readonly optionCounts: readonly PollResultsOptionCount[];
}

export async function getPollResults(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
): Promise<PollResults> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify poll exists
    const [poll] = await tx
      .select({ id: polls.id })
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId)))
      .limit(1);

    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    // Count non-archived votes grouped by optionId
    const optionRows = await tx
      .select({
        optionId: pollVotes.optionId,
        count: count(),
      })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.systemId, systemId),
          eq(pollVotes.archived, false),
        ),
      )
      .groupBy(pollVotes.optionId);

    // Count vetoes separately
    const [vetoRow] = await tx
      .select({ count: count() })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.systemId, systemId),
          eq(pollVotes.archived, false),
          eq(pollVotes.isVeto, true),
        ),
      );

    const optionCounts: PollResultsOptionCount[] = optionRows.map((row) => ({
      optionId: row.optionId ?? null,
      count: row.count,
    }));

    const totalVotes = optionCounts.reduce((sum, oc) => sum + oc.count, 0);

    return {
      pollId,
      totalVotes,
      vetoCount: vetoRow?.count ?? 0,
      optionCounts,
    };
  });
}
