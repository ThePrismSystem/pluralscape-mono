import { pollVotes } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, PollVoteId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
