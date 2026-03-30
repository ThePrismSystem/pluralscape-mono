import { z } from "zod/v4";

export const PurgeSystemBodySchema = z
  .object({
    password: z.string().min(1),
  })
  .readonly();
