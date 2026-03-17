import { z } from "zod/v4";

import {
  MAX_BIOMETRIC_TOKEN_LENGTH,
  MAX_ENCRYPTED_SYSTEM_DATA_SIZE,
  MAX_LOCALE_LENGTH,
} from "./validation.constants.js";

// ── System Settings ────────────────────────────────────────────────

export const UpdateSystemSettingsBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
    locale: z.string().min(1).max(MAX_LOCALE_LENGTH).optional(),
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
    locale: z.string().min(1).max(MAX_LOCALE_LENGTH).optional(),
    biometricEnabled: z.boolean().optional(),
    recoveryKeyBackupConfirmed: z.literal(true),
  })
  .readonly();
