import { lifecycleEvents } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import { validateLifecycleMetadata, type PlaintextMetadata } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
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
import type { UpdateLifecycleEventBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  body: z.infer<typeof UpdateLifecycleEventBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [current] = await tx
      .select()
      .from(lifecycleEvents)
      .where(
        and(
          eq(lifecycleEvents.id, eventId),
          eq(lifecycleEvents.systemId, systemId),
          eq(lifecycleEvents.archived, false),
        ),
      )
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
    }

    let metadata: PlaintextMetadata | undefined;
    if (body.plaintextMetadata) {
      const effectiveEventType = body.eventType ?? current.eventType;
      const metaResult = validateLifecycleMetadata(effectiveEventType, body.plaintextMetadata);
      if (!metaResult.success) {
        throw new ApiHttpError(
          HTTP_BAD_REQUEST,
          "VALIDATION_ERROR",
          `Invalid plaintext metadata for event type "${effectiveEventType}"`,
        );
      }
      metadata = body.plaintextMetadata;
    }

    const [row] = await tx
      .update(lifecycleEvents)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${lifecycleEvents.version} + 1`,
        eventType: body.eventType ?? current.eventType,
        occurredAt:
          body.occurredAt !== undefined ? toUnixMillis(body.occurredAt) : current.occurredAt,
        plaintextMetadata: metadata ?? current.plaintextMetadata,
      })
      .where(
        and(
          eq(lifecycleEvents.id, eventId),
          eq(lifecycleEvents.systemId, systemId),
          eq(lifecycleEvents.version, version),
          eq(lifecycleEvents.archived, false),
        ),
      )
      .returning();

    if (!row) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
    }

    await audit(tx, {
      eventType: "lifecycle-event.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Lifecycle event updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "lifecycle.event-recorded", {
      eventId: brandId<LifecycleEventId>(row.id),
    });

    return toLifecycleEventResult(row);
  });
}
