import { z } from "zod/v4";

import { AUTH_MIN_PASSWORD_LENGTH } from "./validation.constants.js";

export const LoginCredentialsSchema = z
  .object({
    email: z.email(),
    // Minimum length ensures non-empty; strength rules enforced by auth service
    password: z.string().min(1),
  })
  .readonly();

export const RegistrationInputSchema = z
  .object({
    email: z.email(),
    // Minimum length ensures non-empty; strength rules enforced by auth service
    password: z.string().min(1),
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
    newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH),
  })
  .readonly();
