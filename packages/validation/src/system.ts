import { z } from "zod/v4";

export const UpdateSystemBodySchema = z
  .object({
    encryptedData: z.string().min(1),
    version: z.int().min(1),
  })
  .readonly();
