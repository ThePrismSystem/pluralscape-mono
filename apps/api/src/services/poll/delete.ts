import { polls, pollVotes } from "@pluralscape/db/pg";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { deleteEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
