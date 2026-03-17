import { hashPin, verifyPin as cryptoVerifyPin } from "@pluralscape/crypto";
import { systemSettings, systems } from "@pluralscape/db/pg";
import { SetPinBodySchema, VerifyPinBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Dummy Argon2id hash for anti-timing attacks on PIN verification.
 * Used when no PIN is set — we run verification against this to equalize timing.
 * Generated with: hashPin("0000", "server")
 */
const DUMMY_ARGON2_PIN_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";

// ── Helpers ─────────────────────────────────────────────────────────

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

// ── SET PIN ─────────────────────────────────────────────────────────

export async function setPin(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const parsed = SetPinBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid PIN payload");
  }

  await verifySystemOwnership(db, systemId, auth);

  const pinHash = hashPin(parsed.data.pin, "server");

  const updated = await db
    .update(systemSettings)
    .set({ pinHash })
    .where(eq(systemSettings.systemId, systemId))
    .returning({ id: systemSettings.id });

  if (updated.length === 0) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
  }

  await audit(db, {
    eventType: "settings.pin-set",
    actor: { kind: "account", id: auth.accountId },
    detail: "PIN set",
    systemId,
  });
}

// ── REMOVE PIN ──────────────────────────────────────────────────────

export async function removePin(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await verifySystemOwnership(db, systemId, auth);

  const updated = await db
    .update(systemSettings)
    .set({ pinHash: null })
    .where(eq(systemSettings.systemId, systemId))
    .returning({ id: systemSettings.id });

  if (updated.length === 0) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
  }

  await audit(db, {
    eventType: "settings.pin-removed",
    actor: { kind: "account", id: auth.accountId },
    detail: "PIN removed",
    systemId,
  });
}

// ── VERIFY PIN ──────────────────────────────────────────────────────

export async function verifyPinCode(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<{ verified: true }> {
  const parsed = VerifyPinBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid PIN payload");
  }

  await verifySystemOwnership(db, systemId, auth);

  const [row] = await db
    .select({ pinHash: systemSettings.pinHash })
    .from(systemSettings)
    .where(eq(systemSettings.systemId, systemId))
    .limit(1);

  // Anti-timing: run verification even when no PIN is set
  const storedHash = row?.pinHash ?? DUMMY_ARGON2_PIN_HASH;
  const valid = cryptoVerifyPin(storedHash, parsed.data.pin);

  if (!row?.pinHash || !valid) {
    throw new ApiHttpError(HTTP_UNAUTHORIZED, "INVALID_PIN", "PIN is incorrect");
  }

  await audit(db, {
    eventType: "settings.pin-verified",
    actor: { kind: "account", id: auth.accountId },
    detail: "PIN verified",
    systemId,
  });

  return { verified: true };
}
