import { acknowledgements } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toAcknowledgementResult, type AcknowledgementResult } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, AcknowledgementId } from "@pluralscape/types";
import type { CreateAcknowledgementBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateAcknowledgementBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const ackId = brandId<AcknowledgementId>(createId(ID_PREFIXES.acknowledgement));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(acknowledgements)
      .values({
        id: ackId,
        systemId,
        createdByMemberId: body.createdByMemberId ?? null,
        confirmed: false,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create acknowledgement — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "acknowledgement.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Acknowledgement created",
      systemId,
    });
    const result = toAcknowledgementResult(row);
    await dispatchWebhookEvent(tx, systemId, "acknowledgement.created", {
      acknowledgementId: result.id,
    });

    return result;
  });
}
