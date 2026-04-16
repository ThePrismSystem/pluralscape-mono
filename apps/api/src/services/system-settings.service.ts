import { serializeEncryptedBlob } from "@pluralscape/crypto";
import { systemSettings } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import { UpdateSystemSettingsBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { SYSTEM_SETTINGS_CACHE_TTL_MS } from "../lib/cache.constants.js";
import { validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { QueryCache } from "../lib/query-cache.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

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

// ── Cache ───────────────────────────────────────────────────────────

const settingsCache = new QueryCache<SystemSettingsResult>(SYSTEM_SETTINGS_CACHE_TTL_MS);

/** Exported for test teardown. */
export function clearSettingsCache(): void {
  settingsCache.clear();
}

// ── Helpers ─────────────────────────────────────────────────────────

export function toSystemSettingsResult(row: {
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
    id: brandId<SystemSettingsId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    locale: row.locale,
    biometricEnabled: row.biometricEnabled,
    encryptedData: Buffer.from(serializeEncryptedBlob(row.encryptedData)).toString("base64"),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSystemSettings(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SystemSettingsResult> {
  assertSystemOwnership(systemId, auth);

  const cached = settingsCache.get(systemId);
  if (cached) return cached;

  const result = await withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
    }

    return toSystemSettingsResult(row);
  });

  settingsCache.set(systemId, result);
  return result;
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

  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  const result = await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemSettings)
      .set({
        encryptedData: blob,
        ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
        ...(parsed.data.biometricEnabled !== undefined && {
          biometricEnabled: parsed.data.biometricEnabled,
        }),
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

    return toSystemSettingsResult(row);
  });
  settingsCache.invalidate(systemId);
  return result;
}
