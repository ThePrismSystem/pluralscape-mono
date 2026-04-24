import { deviceTransferRequests } from "@pluralscape/db/pg";
import { and, eq, gt, sql } from "drizzle-orm";

import { withAccountTransaction } from "../../lib/rls-context.js";

import { TransferNotFoundError, TransferSessionMismatchError } from "./errors.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId, DeviceTransferRequestId, SessionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Approve a pending device transfer from the source device.
 *
 * Only the session that initiated the transfer (sourceSessionId) may approve it.
 * Uses OCC by matching on status="pending" to prevent double-approval races.
 */
export async function approveTransfer(
  db: PostgresJsDatabase,
  transferId: DeviceTransferRequestId,
  accountId: AccountId,
  sessionId: SessionId,
  audit: AuditWriter,
): Promise<void> {
  await withAccountTransaction(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        id: deviceTransferRequests.id,
        sourceSessionId: deviceTransferRequests.sourceSessionId,
      })
      .from(deviceTransferRequests)
      .where(
        and(
          eq(deviceTransferRequests.id, transferId),
          eq(deviceTransferRequests.accountId, accountId),
          eq(deviceTransferRequests.status, "pending"),
          gt(deviceTransferRequests.expiresAt, sql`now()`),
        ),
      )
      .limit(1);

    if (!row) {
      throw new TransferNotFoundError("Transfer request not found or expired");
    }

    if (row.sourceSessionId !== sessionId) {
      throw new TransferSessionMismatchError(
        "Only the initiating session may approve this transfer",
      );
    }

    const [updated] = await tx
      .update(deviceTransferRequests)
      .set({ status: "approved" })
      .where(
        and(
          eq(deviceTransferRequests.id, transferId),
          eq(deviceTransferRequests.status, "pending"),
        ),
      )
      .returning({ id: deviceTransferRequests.id });

    if (!updated) {
      throw new TransferNotFoundError("Transfer already approved or expired");
    }

    await audit(tx, {
      eventType: "auth.device-transfer-approved",
      actor: { kind: "account", id: accountId },
      detail: `Transfer ${transferId} approved`,
    });
  });
}
