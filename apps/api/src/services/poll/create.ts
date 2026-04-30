import { polls } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId, toUnixMillis } from "@pluralscape/types";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES, POLL_STATUS_OPEN } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toPollResult } from "./internal.js";

import type { PollResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, PollId } from "@pluralscape/types";
import type { CreatePollBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createPoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreatePollBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const pollId = brandId<PollId>(createId(ID_PREFIXES.poll));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(polls)
      .values({
        id: pollId,
        systemId,
        createdByMemberId: body.createdByMemberId ?? null,
        kind: body.kind,
        status: POLL_STATUS_OPEN,
        closedAt: null,
        endsAt: body.endsAt !== undefined ? toUnixMillis(body.endsAt) : null,
        allowMultipleVotes: body.allowMultipleVotes,
        maxVotesPerMember: body.maxVotesPerMember,
        allowAbstain: body.allowAbstain,
        allowVeto: body.allowVeto,
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
