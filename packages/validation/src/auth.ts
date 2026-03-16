import { z } from "zod/v4";

export const LoginCredentialsSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .readonly();

export const RegistrationInputSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
    recoveryKeyBackupConfirmed: z.boolean(),
  })
  .readonly();
