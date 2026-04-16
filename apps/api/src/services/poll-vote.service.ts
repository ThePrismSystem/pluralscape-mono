import { polls, pollVotes } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CastVoteBodySchema,
  PollVoteQuerySchema,
  UpdatePollVoteBodySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import { parseQuery } from "../lib/query-parse.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
  POLL_STATUS_CLOSED,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EntityReference,
  PaginatedResult,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface PollVoteResult {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}

interface ListVoteOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toVoteResult(row: typeof pollVotes.$inferSelect): PollVoteResult {
  return {
    id: row.id as PollVoteId,
    pollId: row.pollId as PollId,
    optionId: (row.optionId ?? null) as PollOptionId | null,
    voter: row.voter,
    isVeto: row.isVeto,
    votedAt: toUnixMillis(row.votedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── CAST VOTE ───────────────────────────────────────────────────────

export async function castVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollVoteResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CastVoteBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // 1. Fetch the poll (FOR UPDATE to serialize concurrent vote casts)
    const [poll] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1)
      .for("update");

    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    // 2. Check poll is open
    if (poll.status === POLL_STATUS_CLOSED) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
    }

    // 2b. Check time-based expiry
    if (poll.endsAt !== null && now() >= poll.endsAt) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll has ended");
    }

    // 3. Abstain check
    const optionId = parsed.optionId;
    if (optionId === null && !poll.allowAbstain) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "ABSTAIN_NOT_ALLOWED",
        "Abstain is not allowed for this poll",
      );
    }

    // 4. Veto check
    if (parsed.isVeto && !poll.allowVeto) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "VETO_NOT_ALLOWED",
        "Veto is not allowed for this poll",
      );
    }

    // 5. Cooperative enforcement: count existing votes by this voter
    const voter = parsed.voter as EntityReference<"member" | "structure-entity">;
    const [voteCountResult] = await tx
      .select({ count: count() })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.systemId, systemId),
          sql`${pollVotes.voter}->>'entityType' = ${voter.entityType} AND ${pollVotes.voter}->>'entityId' = ${voter.entityId}`,
        ),
      );

    const existingCount = voteCountResult?.count ?? 0;
    const effectiveMax = poll.allowMultipleVotes ? poll.maxVotesPerMember : 1;
    if (existingCount >= effectiveMax) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "TOO_MANY_VOTES",
        "Voter has reached the maximum number of votes",
      );
    }

    // 6. Insert the vote
    const voteId = createId(ID_PREFIXES.pollVote);
    const timestamp = now();

    const [row] = await tx
      .insert(pollVotes)
      .values({
        id: voteId,
        pollId,
        systemId,
        optionId,
        voter,
        isVeto: parsed.isVeto,
        votedAt: timestamp,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to cast vote — INSERT returned no rows");
    }

    // 7. Audit
    await audit(tx, {
      eventType: parsed.isVeto ? "poll-vote.vetoed" : "poll-vote.cast",
      actor: { kind: "account", id: auth.accountId },
      detail: parsed.isVeto ? "Poll vote vetoed" : "Poll vote cast",
      systemId,
    });
    const result = toVoteResult(row);
    await dispatchWebhookEvent(
      tx,
      systemId,
      parsed.isVeto ? "poll-vote.vetoed" : "poll-vote.cast",
      { pollId: pollId, voteId: result.id },
    );

    return result;
  });
}

// ── LIST VOTES ──────────────────────────────────────────────────────

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

// ── UPDATE VOTE ────────────────────────────────────────────────────

export async function updatePollVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  voteId: PollVoteId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollVoteResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdatePollVoteBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Fetch the vote with row lock for OCC
    const [existing] = await tx
      .select()
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.id, voteId),
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.systemId, systemId),
          eq(pollVotes.archived, false),
        ),
      )
      .for("update")
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll vote not found");
    }

    // Verify the parent poll is still open
    const [poll] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1);

    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    if (poll.status === POLL_STATUS_CLOSED) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
    }

    if (poll.endsAt !== null && now() >= poll.endsAt) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll has ended");
    }

    // Veto check
    if (parsed.isVeto === true && !poll.allowVeto) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "VETO_NOT_ALLOWED",
        "Veto is not allowed for this poll",
      );
    }

    // Abstain check
    if (parsed.optionId === null && !poll.allowAbstain) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "ABSTAIN_NOT_ALLOWED",
        "Abstain is not allowed for this poll",
      );
    }

    const timestamp = now();
    const [updated] = await tx
      .update(pollVotes)
      .set({
        optionId: parsed.optionId,
        isVeto: parsed.isVeto ?? existing.isVeto,
        encryptedData: blob,
        votedAt: timestamp,
      })
      .where(and(eq(pollVotes.id, voteId), eq(pollVotes.systemId, systemId)))
      .returning();

    if (!updated) {
      throw new Error("Failed to update poll vote — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "poll-vote.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll vote updated",
      systemId,
    });

    const result = toVoteResult(updated);
    await dispatchWebhookEvent(tx, systemId, "poll-vote.updated", {
      pollId,
      voteId: result.id,
    });

    return result;
  });
}

// ── DELETE (ARCHIVE) VOTE ──────────────────────────────────────────

/**
 * Soft-archives a poll vote. Poll votes use an append-only CRDT strategy,
 * so hard deletes are not permitted — we archive instead to preserve
 * the immutable append log.
 */
export async function deletePollVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  voteId: PollVoteId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: pollVotes.id, archived: pollVotes.archived })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.id, voteId),
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.systemId, systemId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll vote not found");
    }

    if (existing.archived) {
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_ARCHIVED", "Poll vote is already archived");
    }

    const timestamp = now();
    await tx
      .update(pollVotes)
      .set({ archived: true, archivedAt: timestamp })
      .where(and(eq(pollVotes.id, voteId), eq(pollVotes.systemId, systemId)));

    await audit(tx, {
      eventType: "poll-vote.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll vote archived",
      systemId,
    });

    await dispatchWebhookEvent(tx, systemId, "poll-vote.archived", {
      pollId,
      voteId,
    });
  });
}

// ── POLL RESULTS ───────────────────────────────────────────────────

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

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parsePollVoteQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
} {
  return parseQuery(PollVoteQuerySchema, query);
}
