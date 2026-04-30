import { polls, pollVotes } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES, POLL_STATUS_CLOSED } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toVoteResult } from "./internal.js";

import type { PollVoteResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, PollOptionId, PollVoteId, SystemId } from "@pluralscape/types";
import type { UpdatePollVoteBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updatePollVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  voteId: PollVoteId,
  body: z.infer<typeof UpdatePollVoteBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollVoteResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

    if (body.isVeto === true && !poll.allowVeto) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "VETO_NOT_ALLOWED",
        "Veto is not allowed for this poll",
      );
    }

    if (body.optionId === null && !poll.allowAbstain) {
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
        optionId: body.optionId === null ? null : brandId<PollOptionId>(body.optionId),
        isVeto: body.isVeto ?? existing.isVeto,
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
