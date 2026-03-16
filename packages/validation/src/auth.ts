import { z } from "zod/v4";

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
  })
  .readonly();
