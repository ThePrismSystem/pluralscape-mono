import { systemSettings } from "@pluralscape/db/pg";
import { systems } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { hashPinOffload, verifyPinOffload } from "../lib/kdf-offload.js";
import { withAccountTransaction } from "../lib/rls-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AccountId, PinHash, SystemId } from "@pluralscape/types";
import type {
  RemovePinBodySchema,
  SetPinBodySchema,
  VerifyPinBodySchema,
} from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

/**
 * Dummy Argon2id hash for anti-timing attacks on PIN verification.
 * Used when no PIN is set -- we run verification against this to equalize timing.
 */
const DUMMY_ARGON2_PIN_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Resolve the primary system for an account.
 * Account-level PIN operates on the account's system settings.
 */
async function resolveSystemId(tx: PostgresJsDatabase, accountId: AccountId): Promise<SystemId> {
  const [row] = await tx
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.accountId, accountId))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "No system found for account");
  }

  return brandId<SystemId>(row.id);
}

// ── SET PIN ─────────────────────────────────────────────────────────

export async function setAccountPin(
  db: PostgresJsDatabase,
  accountId: AccountId,
  body: z.infer<typeof SetPinBodySchema>,
  audit: AuditWriter,
): Promise<void> {
  const pinHash = (await hashPinOffload(body.pin)) as PinHash;

  await withAccountTransaction(db, accountId, async (tx) => {
    const systemId = await resolveSystemId(tx, accountId);

    const updated = await tx
      .update(systemSettings)
      .set({ pinHash })
      .where(eq(systemSettings.systemId, systemId))
      .returning({ id: systemSettings.id });

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
    }

    await audit(tx, {
      eventType: "settings.pin-set",
      actor: { kind: "account", id: accountId },
      detail: "Account PIN set",
    });
  });
}

// ── REMOVE PIN ──────────────────────────────────────────────────────

export async function removeAccountPin(
  db: PostgresJsDatabase,
  accountId: AccountId,
  body: z.infer<typeof RemovePinBodySchema>,
  audit: AuditWriter,
): Promise<void> {
  await withAccountTransaction(db, accountId, async (tx) => {
    const systemId = await resolveSystemId(tx, accountId);

    const [row] = await tx
      .select({ pinHash: systemSettings.pinHash })
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1)
      .for("update");

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
    }

    if (!row.pinHash) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "No PIN is set");
    }

    const valid = await verifyPinOffload(row.pinHash, body.pin);
    if (!valid) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "INVALID_PIN", "PIN is incorrect");
    }

    await tx
      .update(systemSettings)
      .set({ pinHash: null })
      .where(eq(systemSettings.systemId, systemId));

    await audit(tx, {
      eventType: "settings.pin-removed",
      actor: { kind: "account", id: accountId },
      detail: "Account PIN removed",
    });
  });
}

// ── VERIFY PIN ──────────────────────────────────────────────────────

export async function verifyAccountPin(
  db: PostgresJsDatabase,
  accountId: AccountId,
  body: z.infer<typeof VerifyPinBodySchema>,
  audit: AuditWriter,
): Promise<{ verified: true }> {
  return withAccountTransaction(db, accountId, async (tx) => {
    const systemId = await resolveSystemId(tx, accountId);

    const [row] = await tx
      .select({ pinHash: systemSettings.pinHash })
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1);

    // Anti-timing: always run verification even when no PIN is set
    const storedHash = row?.pinHash ?? DUMMY_ARGON2_PIN_HASH;
    const valid = await verifyPinOffload(storedHash, body.pin);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System settings not found");
    }
    if (!row.pinHash) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "No PIN is set");
    }
    if (!valid) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "INVALID_PIN", "PIN is incorrect");
    }

    await audit(tx, {
      eventType: "settings.pin-verified",
      actor: { kind: "account", id: accountId },
      detail: "Account PIN verified",
    });

    return { verified: true };
  });
}
