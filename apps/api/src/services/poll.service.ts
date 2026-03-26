import { polls, pollVotes } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreatePollBodySchema, UpdatePollBodySchema } from "@pluralscape/validation";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../lib/entity-lifecycle.js";
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
    id: row.id as PollId,
    systemId: row.systemId as SystemId,
    createdByMemberId: row.createdByMemberId as MemberId | null,
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
        status: "open",
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
    await dispatchWebhookEvent(tx, systemId, "poll.created", {
      pollId: row.id as PollId,
    });

    return toPollResult(row);
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

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toPollResult);
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? toCompositeCursor(lastItem.createdAt, lastItem.id) : null;

    return { items, nextCursor, hasMore, totalCount: null };
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
          eq(polls.status, "open"),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      // Custom fallback: distinguish archived / POLL_CLOSED / version mismatch / NOT_FOUND
      const [existing] = await tx
        .select({ id: polls.id, status: polls.status, archived: polls.archived })
        .from(polls)
        .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId)))
        .limit(1);

      if (!existing || existing.archived) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
      }
      if (existing.status === "closed") {
        throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
      }
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
    }

    await audit(tx, {
      eventType: "poll.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "poll.updated", {
      pollId: row.id as PollId,
    });

    return toPollResult(row);
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
        status: "closed",
        closedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${polls.version} + 1`,
      })
      .where(
        and(
          eq(polls.id, pollId),
          eq(polls.systemId, systemId),
          eq(polls.status, "open"),
          eq(polls.archived, false),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const [existing] = await tx
        .select({ id: polls.id, status: polls.status, archived: polls.archived })
        .from(polls)
        .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId)))
        .limit(1);

      if (!existing || existing.archived) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
      }
      if (existing.status === "closed") {
        throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    await audit(tx, {
      eventType: "poll.closed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll closed",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "poll.closed", {
      pollId: row.id as PollId,
    });

    return toPollResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

type PollDependentType = "pollVotes";

export async function deletePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: polls.id })
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

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

    await audit(tx, {
      eventType: "poll.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Poll deleted",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "poll.deleted", {
      pollId: pollId,
    });

    await tx.delete(polls).where(and(eq(polls.id, pollId), eq(polls.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const POLL_LIFECYCLE: ArchivableEntityConfig = {
  table: polls,
  columns: polls,
  entityName: "Poll",
  archiveEvent: "poll.archived" as const,
  restoreEvent: "poll.restored" as const,
  onArchive: (tx: PostgresJsDatabase, sId: SystemId, eid: string) =>
    dispatchWebhookEvent(tx, sId, "poll.archived", { pollId: eid as PollId }),
  onRestore: (tx: PostgresJsDatabase, sId: SystemId, eid: string) =>
    dispatchWebhookEvent(tx, sId, "poll.restored", { pollId: eid as PollId }),
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
