import { acknowledgements } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toAcknowledgementResult, type AcknowledgementResult } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AcknowledgementId, SystemId } from "@pluralscape/types";
import type { ConfirmAcknowledgementBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function confirmAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  body: z.infer<typeof ConfirmAcknowledgementBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  const newBlob =
    body.encryptedData !== undefined
      ? validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES)
      : undefined;

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select()
      .from(acknowledgements)
      .where(
        and(
          eq(acknowledgements.id, ackId),
          eq(acknowledgements.systemId, systemId),
          eq(acknowledgements.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Acknowledgement not found");
    }

    if (existing.confirmed) {
      return toAcknowledgementResult(existing);
    }

    const [updated] = await tx
      .update(acknowledgements)
      .set({
        confirmed: true,
        updatedAt: timestamp,
        version: sql`${acknowledgements.version} + 1`,
        ...(newBlob !== undefined ? { encryptedData: newBlob } : {}),
      })
      .where(and(eq(acknowledgements.id, ackId), eq(acknowledgements.systemId, systemId)))
      .returning();

    if (!updated) {
      throw new Error("Failed to confirm acknowledgement — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "acknowledgement.confirmed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Acknowledgement confirmed",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "acknowledgement.confirmed", {
      acknowledgementId: ackId,
    });

    return toAcknowledgementResult(updated);
  });
}
