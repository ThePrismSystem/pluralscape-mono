import { boardMessages } from "@pluralscape/db/pg";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { ReorderBoardMessagesBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function reorderBoardMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof ReorderBoardMessagesBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const targetIds = body.operations.map((op) => op.boardMessageId);
    if (new Set(targetIds).size !== targetIds.length) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Duplicate board message IDs in reorder operations",
      );
    }

    const cases = body.operations.map(
      (op) => sql`WHEN ${boardMessages.id} = ${op.boardMessageId} THEN ${op.sortOrder}`,
    );

    const updatedRows = await tx
      .update(boardMessages)
      .set({
        sortOrder: sql<number>`CASE ${sql.join(cases, sql` `)} ELSE ${boardMessages.sortOrder} END::integer`,
      })
      .where(
        and(
          inArray(boardMessages.id, targetIds),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.archived, false),
        ),
      )
      .returning({ id: boardMessages.id });

    if (updatedRows.length !== body.operations.length) {
      const updatedIds = new Set(updatedRows.map((r) => r.id));
      const missing = targetIds.filter((id) => !updatedIds.has(id));
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Board message(s) not found: ${missing.join(", ")}`,
      );
    }

    await audit(tx, {
      eventType: "board-message.reordered",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(body.operations.length)} board message(s)`,
      systemId,
    });
    await Promise.all(
      body.operations.map((op) =>
        dispatchWebhookEvent(tx, systemId, "board-message.reordered", {
          boardMessageId: op.boardMessageId,
        }),
      ),
    );
  });
}
