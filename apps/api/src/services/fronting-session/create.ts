import { frontingSessions } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateFrontingSessionBodySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateFrontingSessionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  if (parsed.endTime !== undefined && parsed.endTime <= parsed.startTime) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "endTime must be after startTime");
  }

  const fsId = brandId<FrontingSessionId>(createId(ID_PREFIXES.frontingSession));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await validateSubjectIds(tx, systemId, parsed);

    const [row] = await tx
      .insert(frontingSessions)
      .values({
        id: fsId,
        systemId,
        startTime: toUnixMillis(parsed.startTime),
        endTime: parsed.endTime !== undefined ? toUnixMillis(parsed.endTime) : null,
        memberId: parsed.memberId ?? null,
        customFrontId: parsed.customFrontId ?? null,
        structureEntityId: parsed.structureEntityId ?? null,
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
    if (parsed.endTime !== undefined) {
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
