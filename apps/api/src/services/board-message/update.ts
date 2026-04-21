import { boardMessages } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateBoardMessageBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBoardMessageResult } from "./internal.js";

import type { BoardMessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BoardMessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateBoardMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setValues = {
      encryptedData: blob,
      updatedAt: timestamp,
      version: sql`${boardMessages.version} + 1`,
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      ...(parsed.pinned !== undefined ? { pinned: parsed.pinned } : {}),
    };

    const updated = await tx
      .update(boardMessages)
      .set(setValues)
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.version, version),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: boardMessages.id })
          .from(boardMessages)
          .where(and(eq(boardMessages.id, boardMessageId), eq(boardMessages.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Board message",
    );

    await audit(tx, {
      eventType: "board-message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message updated",
      systemId,
    });
    const result = toBoardMessageResult(row);
    await dispatchWebhookEvent(tx, systemId, "board-message.updated", {
      boardMessageId: result.id,
    });

    return result;
  });
}
