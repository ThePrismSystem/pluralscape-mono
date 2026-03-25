import { polls, pollVotes } from "@pluralscape/db/pg";
import {
  CursorInvalidError,
  ID_PREFIXES,
  PAGINATION,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { CastVoteBodySchema } from "@pluralscape/validation";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { fromCursor, toCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  PaginatedResult,
  PaginationCursor,
  PollId,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface PollVoteResult {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: string | null;
  readonly voter: { entityType: string; entityId: string } | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis | null;
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
    optionId: row.optionId ?? null,
    voter: row.voter as PollVoteResult["voter"],
    isVeto: row.isVeto,
    votedAt: toUnixMillisOrNull(row.votedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── Cursor helpers (composite createdAt+id, descending) ─────────────

function toVoteCursor(createdAt: number, id: string): PaginationCursor {
  return toCursor(JSON.stringify({ t: createdAt, i: id }));
}

interface DecodedVoteCursor {
  readonly createdAt: number;
  readonly id: string;
}

function fromVoteCursor(cursor: string): DecodedVoteCursor {
  let raw: string;
  try {
    raw = fromCursor(cursor as PaginationCursor, PAGINATION.cursorTtlMs);
  } catch (error) {
    if (error instanceof CursorInvalidError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", error.message);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed vote cursor");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { t?: unknown }).t !== "number" ||
    typeof (parsed as { i?: unknown }).i !== "string"
  ) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed vote cursor");
  }
  const { t, i } = parsed as { t: number; i: string };
  return { createdAt: t, id: i };
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
    // 1. Fetch the poll
    const [poll] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1);

    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    // 2. Check poll is open
    if (poll.status === "closed") {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
    }

    // 3. Abstain check
    const optionId = parsed.optionId ?? null;
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
    const voter = parsed.voter;
    const [voteCountResult] = await tx
      .select({ count: count() })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          sql`${pollVotes.voter}->>'entityType' = ${voter.entityType} AND ${pollVotes.voter}->>'entityId' = ${voter.entityId}`,
        ),
      );

    const existingCount = voteCountResult?.count ?? 0;
    if (existingCount >= poll.maxVotesPerMember) {
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
        voter: { entityType: voter.entityType, entityId: voter.entityId },
        isVeto: parsed.isVeto,
        votedAt: timestamp,
        encryptedData: blob,
        createdAt: timestamp,
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

    return toVoteResult(row);
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
    const conditions = [eq(pollVotes.pollId, pollId), eq(pollVotes.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(pollVotes.archived, false));
    }

    if (opts.cursor) {
      const decoded = fromVoteCursor(opts.cursor);
      const cursorCondition = or(
        lt(pollVotes.createdAt, decoded.createdAt),
        and(eq(pollVotes.createdAt, decoded.createdAt), lt(pollVotes.id, decoded.id)),
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

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toVoteResult);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? toVoteCursor(lastItem.createdAt, lastItem.id) : null;

    return { items, nextCursor, hasMore, totalCount: null };
  });
}
