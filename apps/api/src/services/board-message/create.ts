import { boardMessages } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId } from "@pluralscape/types";
import { CreateBoardMessageBodySchema } from "@pluralscape/validation";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBoardMessageResult } from "./internal.js";

import type { BoardMessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, BoardMessageId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateBoardMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const boardMessageId = brandId<BoardMessageId>(createId(ID_PREFIXES.boardMessage));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(boardMessages)
      .values({
        id: boardMessageId,
        systemId,
        pinned: parsed.pinned,
        sortOrder: parsed.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create board message — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "board-message.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message created",
      systemId,
    });
    const result = toBoardMessageResult(row);
    await dispatchWebhookEvent(tx, systemId, "board-message.created", {
      boardMessageId: result.id,
    });

    return result;
  });
}
