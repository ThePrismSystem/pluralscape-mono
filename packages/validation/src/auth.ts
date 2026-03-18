import { z } from "zod/v4";

import {
  AUTH_MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_RECOVERY_KEY_LENGTH,
} from "./validation.constants.js";

export const LoginCredentialsSchema = z
  .object({
    email: z.email(),
    // Minimum length ensures non-empty; max prevents Argon2 DoS
    password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  })
  .readonly();

export const RegistrationInputSchema = z
  .object({
    email: z.email(),
    password: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
    recoveryKeyBackupConfirmed: z.boolean(),
    accountType: z.enum(["system", "viewer"]).default("system"),
  })
  .readonly();

export const ChangeEmailSchema = z
  .object({
    email: z.email(),
    currentPassword: z.string().min(1),
  })
  .readonly();

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .readonly();

export const RegenerateRecoveryKeySchema = z
  .object({
    currentPassword: z.string().min(1),
    confirmed: z.literal(true),
  })
  .readonly();

export const PasswordResetViaRecoveryKeySchema = z
  .object({
    email: z.email(),
    recoveryKey: z.string().min(1).max(MAX_RECOVERY_KEY_LENGTH),
    newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .readonly();
