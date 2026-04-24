import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, toUnixMillis } from "@pluralscape/types";
import { CreateCheckInRecordBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toCheckInRecordResult } from "./internal.js";

import type { CheckInRecordResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  const result = CreateCheckInRecordBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const parsed = result.data;

  const blob = parsed.encryptedData
    ? validateEncryptedBlob(parsed.encryptedData, MAX_ENCRYPTED_DATA_BYTES)
    : null;

  const recordId = brandId<CheckInRecordId>(createId(ID_PREFIXES.checkInRecord));

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Validate timerConfigId belongs to this system
    const [timerConfig] = await tx
      .select({ id: timerConfigs.id })
      .from(timerConfigs)
      .where(
        and(
          eq(timerConfigs.id, parsed.timerConfigId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!timerConfig) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Timer config not found in system",
      );
    }

    const [row] = await tx
      .insert(checkInRecords)
      .values({
        id: recordId,
        systemId,
        timerConfigId: parsed.timerConfigId,
        scheduledAt: toUnixMillis(parsed.scheduledAt),
        encryptedData: blob,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create check-in record — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "check-in-record.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record created",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}
