import { z } from "zod/v4";

export const DeleteAccountBodySchema = z
  .object({
    password: z.string().min(1),
  })
  .readonly();
