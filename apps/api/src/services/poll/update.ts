import { polls } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdatePollBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES, POLL_STATUS_OPEN } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { throwPollUpdateError, toPollResult } from "./internal.js";

import type { PollResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updatePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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
