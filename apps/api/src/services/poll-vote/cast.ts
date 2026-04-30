import { polls, pollVotes } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, count, eq, sql } from "drizzle-orm";

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
import type {
  EntityReference,
  MemberId,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { CastVoteBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function castVote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  body: z.infer<typeof CastVoteBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollVoteResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [poll] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1)
      .for("update");

    if (!poll) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    if (poll.status === POLL_STATUS_CLOSED) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll is closed");
    }

    if (poll.endsAt !== null && now() >= poll.endsAt) {
      throw new ApiHttpError(HTTP_CONFLICT, "POLL_CLOSED", "Poll has ended");
    }

    const optionId = body.optionId;
    if (optionId === null && !poll.allowAbstain) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "ABSTAIN_NOT_ALLOWED",
        "Abstain is not allowed for this poll",
      );
    }

    if (body.isVeto && !poll.allowVeto) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "VETO_NOT_ALLOWED",
        "Veto is not allowed for this poll",
      );
    }

    const voter: EntityReference<"member" | "structure-entity"> = {
      entityType: body.voter.entityType,
      entityId: brandId<MemberId | SystemStructureEntityId>(body.voter.entityId),
    };
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

    const voteId = brandId<PollVoteId>(createId(ID_PREFIXES.pollVote));
    const brandedOptionId = optionId === null ? null : brandId<PollOptionId>(optionId);
    const timestamp = now();

    const [row] = await tx
      .insert(pollVotes)
      .values({
        id: voteId,
        pollId,
        systemId,
        optionId: brandedOptionId,
        voter,
        isVeto: body.isVeto,
        votedAt: timestamp,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to cast vote — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: body.isVeto ? "poll-vote.vetoed" : "poll-vote.cast",
      actor: { kind: "account", id: auth.accountId },
      detail: body.isVeto ? "Poll vote vetoed" : "Poll vote cast",
      systemId,
    });
    const result = toVoteResult(row);
    await dispatchWebhookEvent(tx, systemId, body.isVeto ? "poll-vote.vetoed" : "poll-vote.cast", {
      pollId: pollId,
      voteId: result.id,
    });

    return result;
  });
}
