import { polls } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import { POLL_STATUS_CLOSED } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type {
  EncryptedWire,
  MemberId,
  PollId,
  PollServerMetadata,
  PollStatus,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export type PollResult = EncryptedWire<PollServerMetadata>;

export interface ListPollOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: PollStatus;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function toPollResult(row: typeof polls.$inferSelect): PollResult {
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

/**
 * Discriminate why a poll update/close affected zero rows.
 * Queries the poll to distinguish NOT_FOUND, POLL_CLOSED, and version CONFLICT.
 * Always throws — return type is `never`.
 */
export async function throwPollUpdateError(
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

export const POLL_LIFECYCLE: ArchivableEntityConfig<PollId> = {
  table: polls,
  columns: polls,
  entityName: "Poll",
  archiveEvent: "poll.archived" as const,
  restoreEvent: "poll.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "poll.archived", { pollId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "poll.restored", { pollId: eid }),
};
