import { nomenclatureSettings, systemSettings, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  SetupCompleteBodySchema,
  SetupNomenclatureStepBodySchema,
  SetupProfileStepBodySchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { validateEncryptedBlob } from "../lib/validate-encrypted-blob.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

import { getRecoveryKeyStatus } from "./recovery-key.service.js";
import { toSystemSettingsResult } from "./system-settings.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { SetupStepName, SystemId, SystemSettingsId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── GET Setup Status ────────────────────────────────────────────────

export interface SetupStatus {
  readonly nomenclatureComplete: boolean;
  readonly profileComplete: boolean;
  readonly settingsCreated: boolean;
  readonly recoveryKeyBackedUp: boolean;
  readonly isComplete: boolean;
}

export async function getSetupStatus(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SetupStatus> {
  await assertSystemOwnership(db, systemId, auth);

  const [nomenclatureRow, systemRow, settingsRow, recoveryStatus] = await Promise.all([
    db
      .select({ systemId: nomenclatureSettings.systemId })
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ encryptedData: systems.encryptedData })
      .from(systems)
      .where(eq(systems.id, systemId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: systemSettings.id })
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1)
      .then((rows) => rows[0]),
    getRecoveryKeyStatus(db, auth.accountId),
  ]);

  const nomenclatureComplete = !!nomenclatureRow;
  const profileComplete = !!systemRow?.encryptedData;
  const settingsCreated = !!settingsRow;
  const recoveryKeyBackedUp = recoveryStatus.hasActiveKey;

  return {
    nomenclatureComplete,
    profileComplete,
    settingsCreated,
    recoveryKeyBackedUp,
    isComplete: nomenclatureComplete && profileComplete && settingsCreated && recoveryKeyBackedUp,
  };
}

// ── Step 1: Nomenclature ────────────────────────────────────────────

export interface SetupStepResult {
  readonly success: true;
}

export async function setupNomenclatureStep(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SetupStepResult> {
  const parsed = SetupNomenclatureStepBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid nomenclature payload");
  }

  await assertSystemOwnership(db, systemId, auth);

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  // UPSERT: INSERT ON CONFLICT DO UPDATE for idempotency
  await db
    .insert(nomenclatureSettings)
    .values({
      systemId,
      encryptedData: blob,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: nomenclatureSettings.systemId,
      set: {
        encryptedData: blob,
        updatedAt: timestamp,
      },
    });

  await audit(db, {
    eventType: "setup.step-completed",
    actor: { kind: "account", id: auth.accountId },
    detail: "nomenclature" satisfies SetupStepName,
    systemId,
  });

  return { success: true };
}

// ── Step 2: Profile ─────────────────────────────────────────────────

export async function setupProfileStep(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SetupStepResult> {
  const parsed = SetupProfileStepBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid profile payload");
  }

  await assertSystemOwnership(db, systemId, auth);

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  const updated = await db
    .update(systems)
    .set({
      encryptedData: blob,
      updatedAt: timestamp,
    })
    .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
    .returning({ id: systems.id });

  if (updated.length === 0) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  await audit(db, {
    eventType: "setup.step-completed",
    actor: { kind: "account", id: auth.accountId },
    detail: "profile" satisfies SetupStepName,
    systemId,
  });

  return { success: true };
}

// ── Step 3: Complete ────────────────────────────────────────────────

export type SetupCompleteResult = ReturnType<typeof toSystemSettingsResult>;

export async function setupComplete(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SetupCompleteResult> {
  const parsed = SetupCompleteBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid setup complete payload");
  }

  await assertSystemOwnership(db, systemId, auth);

  // Guard: recovery key must exist
  const recoveryStatus = await getRecoveryKeyStatus(db, auth.accountId);
  if (!recoveryStatus.hasActiveKey) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "PRECONDITION_FAILED",
      "Recovery key must be backed up before completing setup",
    );
  }

  // Check preconditions: nomenclature and profile must exist
  const [nomenclatureRow, systemRow] = await Promise.all([
    db
      .select({ systemId: nomenclatureSettings.systemId })
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ encryptedData: systems.encryptedData })
      .from(systems)
      .where(eq(systems.id, systemId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!nomenclatureRow) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "PRECONDITION_FAILED",
      "Nomenclature must be configured before completing setup",
    );
  }

  if (!systemRow?.encryptedData) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "PRECONDITION_FAILED",
      "System profile must be configured before completing setup",
    );
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const id = createId(ID_PREFIXES.systemSettings) as SystemSettingsId;
  const timestamp = now();

  // Atomic insert with onConflictDoNothing to avoid TOCTOU race
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(systemSettings)
      .values({
        id,
        systemId,
        locale: parsed.data.locale ?? null,
        biometricEnabled: parsed.data.biometricEnabled ?? false,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing({ target: systemSettings.systemId })
      .returning();

    if (inserted.length > 0) {
      await audit(tx, {
        eventType: "setup.completed",
        actor: { kind: "account", id: auth.accountId },
        detail: "Setup completed",
        systemId,
      });

      const [row] = inserted as [(typeof inserted)[number], ...typeof inserted];
      return toSystemSettingsResult(row);
    }

    // Already existed — idempotent return
    const [existing] = await tx
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Failed to create system settings");
    }

    return toSystemSettingsResult(existing);
  });
}
