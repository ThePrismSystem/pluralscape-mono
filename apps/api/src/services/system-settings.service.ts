import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { systemSettings, systems } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateSystemSettingsBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../routes/systems/systems.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, SystemId, SystemSettingsId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SystemSettingsResult {
  readonly id: SystemSettingsId;
  readonly systemId: SystemId;
  readonly locale: string | null;
  readonly biometricEnabled: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toResult(row: {
  id: string;
  systemId: string;
  locale: string | null;
  biometricEnabled: boolean;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): SystemSettingsResult {
  return {
    id: row.id as SystemSettingsId,
    systemId: row.systemId as SystemId,
    locale: row.locale,
    biometricEnabled: row.biometricEnabled,
    encryptedData: Buffer.from(serializeEncryptedBlob(row.encryptedData)).toString("base64"),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

async function verifySystemOwnership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<void> {
  const [system] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(
      and(
        eq(systems.id, systemId),
        eq(systems.accountId, auth.accountId),
        eq(systems.archived, false),
      ),
    )
    .limit(1);

  if (!system) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSystemSettings(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SystemSettingsResult> {
  await verifySystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.systemId, systemId))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
  }

  return toResult(row);
}

// ── PUT ─────────────────────────────────────────────────────────────

export async function updateSystemSettings(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SystemSettingsResult> {
  const parsed = UpdateSystemSettingsBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid settings payload");
  }

  await verifySystemOwnership(db, systemId, auth);

  const rawBytes = Buffer.from(parsed.data.encryptedData, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(systemSettings)
      .set({
        encryptedData: blob,
        locale: parsed.data.locale ?? undefined,
        biometricEnabled: parsed.data.biometricEnabled ?? undefined,
        updatedAt: timestamp,
        version: sql`${systemSettings.version} + 1`,
      })
      .where(
        and(eq(systemSettings.systemId, systemId), eq(systemSettings.version, parsed.data.version)),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.systemId, systemId))
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "settings.changed",
      actor: { kind: "account", id: auth.accountId },
      detail: "System settings updated",
      systemId,
    });

    return toResult(row);
  });
}
