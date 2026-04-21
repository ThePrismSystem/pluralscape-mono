import { polls } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { POLL_STATUS_CLOSED, POLL_STATUS_OPEN } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { throwPollUpdateError, toPollResult } from "./internal.js";

import type { PollResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
