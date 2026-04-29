import { frontingSessions } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { validateSubjectIds } from "../../lib/validate-subject-ids.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toFrontingSessionResult } from "./internal.js";

import type { FrontingSessionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingSessionId, SystemId } from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateFrontingSessionBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  if (body.endTime !== undefined && body.endTime <= body.startTime) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "endTime must be after startTime");
  }

  const fsId = brandId<FrontingSessionId>(createId(ID_PREFIXES.frontingSession));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await validateSubjectIds(tx, systemId, body);

    const [row] = await tx
      .insert(frontingSessions)
      .values({
        id: fsId,
        systemId,
        startTime: toUnixMillis(body.startTime),
        endTime: body.endTime !== undefined ? toUnixMillis(body.endTime) : null,
        memberId: body.memberId ?? null,
        customFrontId: body.customFrontId ?? null,
        structureEntityId: body.structureEntityId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting session — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-session.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "fronting.started", {
      sessionId: brandId<FrontingSessionId>(row.id),
    });
    if (body.endTime !== undefined) {
      await audit(tx, {
        eventType: "fronting-session.ended",
        actor: { kind: "account", id: auth.accountId },
        detail: "Fronting session ended",
        systemId,
      });
      await dispatchWebhookEvent(tx, systemId, "fronting.ended", {
        sessionId: brandId<FrontingSessionId>(row.id),
      });
    }

    return toFrontingSessionResult(row);
  });
}
