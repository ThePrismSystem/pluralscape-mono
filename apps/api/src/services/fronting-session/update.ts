import { frontingSessions } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import {
  EndFrontingSessionBodySchema,
  UpdateFrontingSessionBodySchema,
} from "@pluralscape/validation";
import { and, eq, isNull, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toFrontingSessionResult } from "./internal.js";

import type { FrontingSessionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingSessionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateFrontingSessionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingSessions)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${frontingSessions.version} + 1`,
      })
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.version, version),
          eq(frontingSessions.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingSessions.id })
          .from(frontingSessions)
          .where(
            and(
              eq(frontingSessions.id, sessionId),
              eq(frontingSessions.systemId, systemId),
              eq(frontingSessions.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting session",
    );

    await audit(tx, {
      eventType: "fronting-session.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session updated",
      systemId,
    });

    return toFrontingSessionResult(row);
  });
}

export async function endFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const result = EndFrontingSessionBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const { endTime, version } = result.data;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Read current session to validate state and endTime > startTime
    const [current] = await tx
      .select({
        id: frontingSessions.id,
        startTime: frontingSessions.startTime,
        endTime: frontingSessions.endTime,
      })
      .from(frontingSessions)
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.archived, false),
        ),
      )
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    if (current.endTime !== null) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "ALREADY_ENDED", "Session already ended");
    }

    if (endTime <= current.startTime) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "endTime must be after startTime",
      );
    }

    const updated = await tx
      .update(frontingSessions)
      .set({
        endTime: toUnixMillis(endTime),
        updatedAt: timestamp,
        version: sql`${frontingSessions.version} + 1`,
      })
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.startTime, current.startTime),
          eq(frontingSessions.version, version),
          eq(frontingSessions.archived, false),
          isNull(frontingSessions.endTime),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingSessions.id })
          .from(frontingSessions)
          .where(
            and(
              eq(frontingSessions.id, sessionId),
              eq(frontingSessions.systemId, systemId),
              eq(frontingSessions.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting session",
    );

    await audit(tx, {
      eventType: "fronting-session.ended",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session ended",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "fronting.ended", { sessionId });

    return toFrontingSessionResult(row);
  });
}
