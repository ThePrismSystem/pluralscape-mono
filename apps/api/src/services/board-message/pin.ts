import { boardMessages } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBoardMessageResult } from "./internal.js";

import type { BoardMessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiErrorCode, AuditEventType, BoardMessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface TogglePinConfig {
  readonly targetValue: boolean;
  readonly alreadyError: { readonly code: ApiErrorCode; readonly message: string };
  readonly auditEvent: AuditEventType;
  readonly auditDetail: string;
  readonly webhookEvent: "board-message.pinned" | "board-message.unpinned";
}

const PIN_CONFIG: TogglePinConfig = {
  targetValue: true,
  alreadyError: { code: "ALREADY_PINNED", message: "Board message is already pinned" },
  auditEvent: "board-message.pinned",
  auditDetail: "Board message pinned",
  webhookEvent: "board-message.pinned",
};

const UNPIN_CONFIG: TogglePinConfig = {
  targetValue: false,
  alreadyError: { code: "NOT_PINNED", message: "Board message is not pinned" },
  auditEvent: "board-message.unpinned",
  auditDetail: "Board message unpinned",
  webhookEvent: "board-message.unpinned",
};

async function togglePinned(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: TogglePinConfig,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(boardMessages)
      .set({
        pinned: cfg.targetValue,
        updatedAt: timestamp,
        version: sql`${boardMessages.version} + 1`,
      })
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.pinned, !cfg.targetValue),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({
          id: boardMessages.id,
          pinned: boardMessages.pinned,
          archived: boardMessages.archived,
        })
        .from(boardMessages)
        .where(and(eq(boardMessages.id, boardMessageId), eq(boardMessages.systemId, systemId)))
        .limit(1);

      if (existing?.archived) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Board message is already archived",
        );
      }
      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, cfg.alreadyError.code, cfg.alreadyError.message);
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    await audit(tx, {
      eventType: cfg.auditEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: cfg.auditDetail,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, cfg.webhookEvent, {
      boardMessageId: boardMessageId,
    });

    const row = updated[0];
    if (!row) {
      throw new Error("togglePinned: UPDATE returned no rows after length check");
    }
    return toBoardMessageResult(row);
  });
}

export async function pinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return togglePinned(db, systemId, boardMessageId, auth, audit, PIN_CONFIG);
}

export async function unpinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return togglePinned(db, systemId, boardMessageId, auth, audit, UNPIN_CONFIG);
}
