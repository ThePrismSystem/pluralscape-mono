import { systemSettings } from "@pluralscape/db/pg";
import {
  RemovePinBodySchema,
  SetPinBodySchema,
  VerifyPinBodySchema,
} from "@pluralscape/validation";
import { eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { hashPinOffload, verifyPinOffload } from "../lib/pwhash-offload.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

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

  await assertSystemOwnership(db, systemId, auth);

  const pinHash = await hashPinOffload(parsed.data.pin, "server");

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
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const parsed = RemovePinBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid PIN payload");
  }

  await assertSystemOwnership(db, systemId, auth);

  // Fetch current PIN hash
  const [row] = await db
    .select({ pinHash: systemSettings.pinHash })
    .from(systemSettings)
    .where(eq(systemSettings.systemId, systemId))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
  }

  if (!row.pinHash) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "No PIN is set");
  }

  // Verify current PIN before removal
  const valid = await verifyPinOffload(row.pinHash, parsed.data.pin);
  if (!valid) {
    throw new ApiHttpError(HTTP_UNAUTHORIZED, "INVALID_PIN", "PIN is incorrect");
  }

  await db
    .update(systemSettings)
    .set({ pinHash: null })
    .where(eq(systemSettings.systemId, systemId));

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

  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select({ pinHash: systemSettings.pinHash })
    .from(systemSettings)
    .where(eq(systemSettings.systemId, systemId))
    .limit(1);

  // Anti-timing: always run verification even when no PIN is set
  const storedHash = row?.pinHash ?? DUMMY_ARGON2_PIN_HASH;
  const valid = await verifyPinOffload(storedHash, parsed.data.pin);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
  }
  if (!row.pinHash) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "No PIN is set");
  }
  if (!valid) {
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
