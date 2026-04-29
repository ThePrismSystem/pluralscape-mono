import { polls, pollVotes } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { UpdatePollVoteBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updatePollVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  voteId: PollVoteId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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
        optionId: parsed.optionId === null ? null : brandId<PollOptionId>(parsed.optionId),
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
