import { friendCodes } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withAccountTransaction } from "../../../lib/rls-context.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, AuditEventType, FriendCodeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a friend code was archived. */
const AUDIT_FRIEND_CODE_ARCHIVED: AuditEventType = "friend-code.archived";

/**
 * Soft-archive a friend code. Returns 404 if the code does not exist
 * or is already archived.
 */
export async function archiveFriendCode(
  db: PostgresJsDatabase,
  accountId: AccountId,
  codeId: FriendCodeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const timestamp = now();

  await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendCodes)
      .set({
        archived: true,
        archivedAt: timestamp,
      })
      .where(
        and(
          eq(friendCodes.id, codeId),
          eq(friendCodes.accountId, accountId),
          eq(friendCodes.archived, false),
        ),
      )
      .returning({ id: friendCodes.id });

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend code not found");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_CODE_ARCHIVED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend code archived",
      accountId,
      systemId: null,
    });
  });
}
