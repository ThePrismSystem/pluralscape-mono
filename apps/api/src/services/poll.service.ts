import { polls, pollVotes } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  CreatePollBodySchema,
  PollQuerySchema,
  UpdatePollBodySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, deleteEntity, restoreEntity } from "../lib/entity-lifecycle.js";
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
  POLL_STATUS_OPEN,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig, DeletableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  PaginatedResult,
  MemberId,
  PollId,
  PollKind,
  PollStatus,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Discriminate why a poll update/close affected zero rows.
 * Queries the poll to distinguish NOT_FOUND, POLL_CLOSED, and version CONFLICT.
 * Always throws — return type is `never`.
 */
async function throwPollUpdateError(
  tx: PostgresJsDatabase,
  pollId: PollId,
  systemId: SystemId,
): Promise<never> {
  const [existing] = await tx
    .select({ id: polls.id, status: polls.status, archived: polls.archived })
    .from(polls)
    .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId)))
    .limit(1);

  if (!existing || existing.archived) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
  }
  if (existing.status === POLL_STATUS_CLOSED) {
    throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
  }
  throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
}

// ── Types ───────────────────────────────────────────────────────────

export interface PollResult {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly kind: PollKind;
  readonly status: PollStatus;
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListPollOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: PollStatus;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toPollResult(row: typeof polls.$inferSelect): PollResult {
  return {
    id: brandId<PollId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    createdByMemberId: row.createdByMemberId ? brandId<MemberId>(row.createdByMemberId) : null,
    kind: row.kind,
    status: row.status,
    closedAt: toUnixMillisOrNull(row.closedAt),
    endsAt: toUnixMillisOrNull(row.endsAt),
    allowMultipleVotes: row.allowMultipleVotes,
    maxVotesPerMember: row.maxVotesPerMember,
    allowAbstain: row.allowAbstain,
    allowVeto: row.allowVeto,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createPoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreatePollBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const pollId = createId(ID_PREFIXES.poll);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(polls)
      .values({
        id: pollId,
        systemId,
        createdByMemberId: parsed.createdByMemberId ?? null,
        kind: parsed.kind,
        status: POLL_STATUS_OPEN,
        closedAt: null,
        endsAt: parsed.endsAt ?? null,
        allowMultipleVotes: parsed.allowMultipleVotes,
        maxVotesPerMember: parsed.maxVotesPerMember,
        allowAbstain: parsed.allowAbstain,
        allowVeto: parsed.allowVeto,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create poll — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "poll.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll created",
      systemId,
    });
    const result = toPollResult(row);
    await dispatchWebhookEvent(tx, systemId, "poll.created", {
      pollId: result.id,
    });

    return result;
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getPoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    return toPollResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

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

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updatePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdatePollBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(polls)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${polls.version} + 1`,
      })
      .where(
        and(
          eq(polls.id, pollId),
          eq(polls.systemId, systemId),
          eq(polls.version, version),
          eq(polls.archived, false),
          eq(polls.status, POLL_STATUS_OPEN),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      return throwPollUpdateError(tx, pollId, systemId);
    }

    await audit(tx, {
      eventType: "poll.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll updated",
      systemId,
    });
    const result = toPollResult(row);
    await dispatchWebhookEvent(tx, systemId, "poll.updated", {
      pollId: result.id,
    });

    return result;
  });
}

// ── CLOSE ───────────────────────────────────────────────────────────

export async function closePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(polls)
      .set({
        status: POLL_STATUS_CLOSED,
        closedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${polls.version} + 1`,
      })
      .where(
        and(
          eq(polls.id, pollId),
          eq(polls.systemId, systemId),
          eq(polls.status, POLL_STATUS_OPEN),
          eq(polls.archived, false),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      return throwPollUpdateError(tx, pollId, systemId);
    }

    await audit(tx, {
      eventType: "poll.closed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll closed",
      systemId,
    });
    const result = toPollResult(row);
    await dispatchWebhookEvent(tx, systemId, "poll.closed", {
      pollId: result.id,
    });

    return result;
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

type PollDependentType = "pollVotes";

async function checkPollDependents(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
): Promise<void> {
  const [voteResult] = await tx
    .select({ count: count() })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.systemId, systemId)));

  const voteCount = voteResult?.count ?? 0;
  if (voteCount > 0) {
    const dependents: { type: PollDependentType; count: number }[] = [
      { type: "pollVotes", count: voteCount },
    ];
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "HAS_DEPENDENTS",
      "Poll has dependents. Remove all dependents before deleting.",
      { dependents },
    );
  }
}

const POLL_DELETE: DeletableEntityConfig<PollId> = {
  table: polls,
  columns: polls,
  entityName: "Poll",
  deleteEvent: "poll.deleted",
  onDelete: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "poll.deleted", { pollId: eid }),
  checkDependents: checkPollDependents,
};

export async function deletePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, pollId, auth, audit, POLL_DELETE);
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const POLL_LIFECYCLE: ArchivableEntityConfig<PollId> = {
  table: polls,
  columns: polls,
  entityName: "Poll",
  archiveEvent: "poll.archived" as const,
  restoreEvent: "poll.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "poll.archived", { pollId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "poll.restored", { pollId: eid }),
};

export async function archivePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, pollId, auth, audit, POLL_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restorePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  return restoreEntity(db, systemId, pollId, auth, audit, POLL_LIFECYCLE, (row) =>
    toPollResult(row as typeof polls.$inferSelect),
  );
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parsePollQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  status?: PollStatus;
} {
  return parseQuery(PollQuerySchema, query);
}
