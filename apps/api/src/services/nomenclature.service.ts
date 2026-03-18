import { serializeEncryptedBlob } from "@pluralscape/crypto";
import { nomenclatureSettings } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateNomenclatureBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface NomenclatureSettingsResult {
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toResult(row: {
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): NomenclatureSettingsResult {
  return {
    systemId: row.systemId as SystemId,
    encryptedData: Buffer.from(serializeEncryptedBlob(row.encryptedData)).toString("base64"),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getNomenclatureSettings(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<NomenclatureSettingsResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(nomenclatureSettings)
    .where(eq(nomenclatureSettings.systemId, systemId))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Nomenclature settings not found");
  }

  return toResult(row);
}

// ── PUT ─────────────────────────────────────────────────────────────

export async function updateNomenclatureSettings(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NomenclatureSettingsResult> {
  const parsed = UpdateNomenclatureBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid nomenclature payload");
  }

  await assertSystemOwnership(db, systemId, auth);

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(nomenclatureSettings)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${nomenclatureSettings.version} + 1`,
      })
      .where(
        and(
          eq(nomenclatureSettings.systemId, systemId),
          eq(nomenclatureSettings.version, parsed.data.version),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ systemId: nomenclatureSettings.systemId })
        .from(nomenclatureSettings)
        .where(eq(nomenclatureSettings.systemId, systemId))
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Nomenclature settings not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "settings.nomenclature-updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Nomenclature settings updated",
      systemId,
    });

    return toResult(row);
  });
}
