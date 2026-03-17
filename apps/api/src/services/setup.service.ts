import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
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
import { MAX_ENCRYPTED_DATA_BYTES } from "../routes/systems/systems.constants.js";

import { getRecoveryKeyStatus } from "./recovery-key.service.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, SystemId, SystemSettingsId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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

function validateEncryptedBlob(base64Data: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64Data, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

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
  await verifySystemOwnership(db, systemId, auth);

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

  await verifySystemOwnership(db, systemId, auth);

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
    detail: "nomenclature",
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

  await verifySystemOwnership(db, systemId, auth);

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
    detail: "profile",
    systemId,
  });

  return { success: true };
}

// ── Step 3: Complete ────────────────────────────────────────────────

export interface SetupCompleteResult {
  readonly id: SystemSettingsId;
  readonly systemId: SystemId;
  readonly locale: string | null;
  readonly biometricEnabled: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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

  await verifySystemOwnership(db, systemId, auth);

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

  // Check if settings already exist (idempotent)
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.systemId, systemId))
    .limit(1);

  if (existing) {
    return {
      id: existing.id as SystemSettingsId,
      systemId: existing.systemId as SystemId,
      locale: existing.locale,
      biometricEnabled: existing.biometricEnabled,
      encryptedData: Buffer.from(serializeEncryptedBlob(existing.encryptedData)).toString("base64"),
      version: existing.version,
      createdAt: existing.createdAt as UnixMillis,
      updatedAt: existing.updatedAt as UnixMillis,
    };
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData);
  const id = createId(ID_PREFIXES.systemSettings) as SystemSettingsId;
  const timestamp = now();

  const [row] = await db
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
    .returning();

  if (!row) {
    throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Failed to create system settings");
  }

  await audit(db, {
    eventType: "setup.completed",
    actor: { kind: "account", id: auth.accountId },
    detail: "Setup completed",
    systemId,
  });

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
