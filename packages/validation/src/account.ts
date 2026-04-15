import { z } from "zod/v4";

export const DeleteAccountBodySchema = z
  .object({
    authKey: z.string().min(1),
  })
  .readonly();
