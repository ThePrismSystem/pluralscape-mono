import { nomenclatureSettings, systemSettings, systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  SetupCompleteBodySchema,
  SetupNomenclatureStepBodySchema,
  SetupProfileStepBodySchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

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
  assertSystemOwnership(systemId, auth);

  const [tenantResult, recoveryStatus] = await Promise.all([
    withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
      const [nomenclatureRow, systemRow, settingsRow] = await Promise.all([
        tx
          .select({ systemId: nomenclatureSettings.systemId })
          .from(nomenclatureSettings)
          .where(eq(nomenclatureSettings.systemId, systemId))
          .limit(1)
          .then((rows) => rows[0]),
        tx
          .select({ encryptedData: systems.encryptedData })
          .from(systems)
          .where(eq(systems.id, systemId))
          .limit(1)
          .then((rows) => rows[0]),
        tx
          .select({ id: systemSettings.id })
          .from(systemSettings)
          .where(eq(systemSettings.systemId, systemId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);
      return { nomenclatureRow, systemRow, settingsRow };
    }),
    getRecoveryKeyStatus(db, auth.accountId),
  ]);

  const nomenclatureComplete = !!tenantResult.nomenclatureRow;
  const profileComplete = !!tenantResult.systemRow?.encryptedData;
  const settingsCreated = !!tenantResult.settingsRow;
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
  assertSystemOwnership(systemId, auth);

  const parsed = SetupNomenclatureStepBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid nomenclature payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // UPSERT: INSERT ON CONFLICT DO UPDATE for idempotency
    await tx
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

    await audit(tx, {
      eventType: "setup.step-completed",
      actor: { kind: "account", id: auth.accountId },
      detail: "nomenclature" satisfies SetupStepName,
      systemId,
    });
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
  assertSystemOwnership(systemId, auth);

  const parsed = SetupProfileStepBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid profile payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
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

    await audit(tx, {
      eventType: "setup.step-completed",
      actor: { kind: "account", id: auth.accountId },
      detail: "profile" satisfies SetupStepName,
      systemId,
    });
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
  assertSystemOwnership(systemId, auth);

  const parsed = SetupCompleteBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid setup complete payload");
  }

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
  const { nomenclatureRow, systemRow } = await withTenantRead(
    db,
    tenantCtx(systemId, auth),
    async (tx) => {
      const [nRow, sRow] = await Promise.all([
        tx
          .select({ systemId: nomenclatureSettings.systemId })
          .from(nomenclatureSettings)
          .where(eq(nomenclatureSettings.systemId, systemId))
          .limit(1)
          .then((rows) => rows[0]),
        tx
          .select({ encryptedData: systems.encryptedData })
          .from(systems)
          .where(eq(systems.id, systemId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);
      return { nomenclatureRow: nRow, systemRow: sRow };
    },
  );

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
  const id = brandId<SystemSettingsId>(createId(ID_PREFIXES.systemSettings));
  const timestamp = now();

  // Atomic insert with onConflictDoNothing to avoid TOCTOU race
  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
