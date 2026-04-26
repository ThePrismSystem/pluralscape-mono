import { SUPPORTED_LOCALES } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import {
  MAX_BIOMETRIC_TOKEN_LENGTH,
  MAX_ENCRYPTED_SYSTEM_DATA_SIZE,
} from "./validation.constants.js";

const LocaleSchema = z.enum(SUPPORTED_LOCALES);

// ── Nested settings schemas ────────────────────────────────────────

const ThemePreferenceSchema = z.enum(["light", "dark", "high-contrast", "system"]);

/** Range bounds for `AppLockConfig` (mirrors the JSDoc on the canonical type). */
const APP_LOCK_TIMEOUT_MAX_MINUTES = 30;
const APP_LOCK_BACKGROUND_GRACE_MAX_SECONDS = 300;

const AppLockConfigSchema = z
  .object({
    pinEnabled: z.boolean(),
    biometricEnabled: z.boolean(),
    lockTimeout: z.number().int().min(1).max(APP_LOCK_TIMEOUT_MAX_MINUTES),
    backgroundGraceSeconds: z.number().int().min(0).max(APP_LOCK_BACKGROUND_GRACE_MAX_SECONDS),
  })
  .readonly();

const NotificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    switchReminders: z.boolean(),
    checkInReminders: z.boolean(),
  })
  .readonly();

const SyncPreferencesSchema = z
  .object({
    syncEnabled: z.boolean(),
    syncOnCellular: z.boolean(),
  })
  .readonly();

const PrivacyDefaultsSchema = z
  .object({
    defaultBucketForNewContent: brandedString<"BucketId">().nullable(),
    friendRequestPolicy: z.enum(["open", "code-only"]),
  })
  .readonly();

const SafeModeUIFlagsSchema = z
  .object({
    largeButtons: z.boolean(),
    iconDriven: z.boolean(),
    noDeletion: z.boolean(),
    noSettings: z.boolean(),
    noAnalytics: z.boolean(),
  })
  .readonly();

const LittlesSafeModeConfigSchema = z
  .object({
    enabled: z.boolean(),
    allowedContentIds: z.array(brandedString<"SafeModeContentId">()).readonly(),
    simplifiedUIFlags: SafeModeUIFlagsSchema,
  })
  .readonly();

const SnapshotScheduleSchema = z.enum(["daily", "weekly", "disabled"]);

/**
 * Runtime validator for the pre-encryption SystemSettings input.
 * Every key in `SystemSettingsEncryptedFields` must be present and
 * well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/system-settings.type.test.ts`.
 */
export const SystemSettingsEncryptedInputSchema = z
  .object({
    theme: ThemePreferenceSchema,
    fontScale: z.number(),
    appLock: AppLockConfigSchema,
    notifications: NotificationPreferencesSchema,
    syncPreferences: SyncPreferencesSchema,
    privacyDefaults: PrivacyDefaultsSchema,
    littlesSafeMode: LittlesSafeModeConfigSchema,
    saturationLevelsEnabled: z.boolean(),
    autoCaptureFrontingOnJournal: z.boolean(),
    snapshotSchedule: SnapshotScheduleSchema,
    onboardingComplete: z.boolean(),
  })
  .readonly();

// ── Nomenclature ───────────────────────────────────────────────────

const TERM_CATEGORIES = [
  "collective",
  "individual",
  "fronting",
  "switching",
  "co-presence",
  "internal-space",
  "primary-fronter",
  "structure",
  "dormancy",
  "body",
  "amnesia",
  "saturation",
] as const;

/**
 * Runtime validator for the pre-encryption NomenclatureSettings input —
 * every term category must map to a non-empty string. Zod compile-time
 * parity is checked in `__tests__/type-parity/nomenclature.type.test.ts`.
 */
export const NomenclatureSettingsEncryptedInputSchema = z
  .object(Object.fromEntries(TERM_CATEGORIES.map((c) => [c, z.string().min(1)])))
  .readonly();

// ── System Settings ────────────────────────────────────────────────

export const UpdateSystemSettingsBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
    locale: LocaleSchema.optional(),
    biometricEnabled: z.boolean().optional(),
    version: z.int().min(1),
  })
  .readonly();

// ── Nomenclature ───────────────────────────────────────────────────

export const UpdateNomenclatureBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── PIN ────────────────────────────────────────────────────────────

const PIN_REGEX = /^\d{4,6}$/;

export const SetPinBodySchema = z
  .object({
    pin: z.string().regex(PIN_REGEX, "PIN must be 4-6 digits"),
  })
  .readonly();

export const RemovePinBodySchema = z
  .object({
    pin: z.string().regex(PIN_REGEX, "PIN must be 4-6 digits"),
  })
  .readonly();

export const VerifyPinBodySchema = z
  .object({
    pin: z.string().regex(PIN_REGEX, "PIN must be 4-6 digits"),
  })
  .readonly();

// ── Biometric ──────────────────────────────────────────────────────

export const BiometricEnrollBodySchema = z
  .object({
    token: z.string().min(1).max(MAX_BIOMETRIC_TOKEN_LENGTH),
  })
  .readonly();

export const BiometricVerifyBodySchema = z
  .object({
    token: z.string().min(1).max(MAX_BIOMETRIC_TOKEN_LENGTH),
  })
  .readonly();

// ── Setup Wizard ───────────────────────────────────────────────────

export const SetupNomenclatureStepBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
  })
  .readonly();

export const SetupProfileStepBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
  })
  .readonly();

export const SetupCompleteBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
    locale: LocaleSchema.optional(),
    biometricEnabled: z.boolean().optional(),
    recoveryKeyBackupConfirmed: z.literal(true),
  })
  .readonly();
