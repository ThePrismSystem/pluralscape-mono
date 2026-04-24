import { lifecycleEvents } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import {
  UpdateLifecycleEventBodySchema,
  validateLifecycleMetadata,
  type PlaintextMetadata,
} from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
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

export async function updateLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateLifecycleEventBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Read the current row to fill in optional fields not provided in the update
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

    // Validate per-event-type metadata if provided
    let metadata: PlaintextMetadata | undefined;
    if (parsed.plaintextMetadata) {
      const effectiveEventType = parsed.eventType ?? current.eventType;
      const metaResult = validateLifecycleMetadata(effectiveEventType, parsed.plaintextMetadata);
      if (!metaResult.success) {
        throw new ApiHttpError(
          HTTP_BAD_REQUEST,
          "VALIDATION_ERROR",
          `Invalid plaintext metadata for event type "${effectiveEventType}"`,
        );
      }
      metadata = parsed.plaintextMetadata;
    }

    const [row] = await tx
      .update(lifecycleEvents)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${lifecycleEvents.version} + 1`,
        eventType: parsed.eventType ?? current.eventType,
        occurredAt:
          parsed.occurredAt !== undefined ? toUnixMillis(parsed.occurredAt) : current.occurredAt,
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

    // Row was confirmed to exist above; zero rows updated means version mismatch
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
