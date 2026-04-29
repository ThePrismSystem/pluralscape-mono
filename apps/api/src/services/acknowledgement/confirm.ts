import { acknowledgements } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { ConfirmAcknowledgementBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function confirmAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  const result = ConfirmAcknowledgementBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid confirmation payload");
  }
  const parsed = result.data;

  const newBlob =
    parsed.encryptedData !== undefined
      ? validateEncryptedBlob(parsed.encryptedData, MAX_ENCRYPTED_DATA_BYTES)
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

    // Idempotent: already confirmed — return current state without writing
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
