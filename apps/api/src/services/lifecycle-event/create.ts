import { lifecycleEvents } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  CreateLifecycleEventBodySchema,
  validateLifecycleMetadata,
  type PlaintextMetadata,
} from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toLifecycleEventResult } from "./internal.js";

import type { LifecycleEventResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { LifecycleEventId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateLifecycleEventBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const eventId = brandId<LifecycleEventId>(createId(ID_PREFIXES.lifecycleEvent));
  const timestamp = now();

  // Validate per-event-type metadata if provided
  let metadata: PlaintextMetadata | null = null;
  if (parsed.plaintextMetadata) {
    const metaResult = validateLifecycleMetadata(parsed.eventType, parsed.plaintextMetadata);
    if (!metaResult.success) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Invalid plaintext metadata for event type "${parsed.eventType}"`,
      );
    }
    metadata = parsed.plaintextMetadata;
  }

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(lifecycleEvents)
      .values({
        id: eventId,
        systemId,
        eventType: parsed.eventType,
        occurredAt: parsed.occurredAt,
        recordedAt: timestamp,
        updatedAt: timestamp,
        encryptedData: blob,
        plaintextMetadata: metadata,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create lifecycle event — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "lifecycle-event.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Lifecycle event ${parsed.eventType} recorded`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "lifecycle.event-recorded", {
      eventId: brandId<LifecycleEventId>(row.id),
    });

    return toLifecycleEventResult(row);
  });
}
