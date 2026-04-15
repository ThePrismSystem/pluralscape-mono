import { z } from "zod/v4";

export const PurgeSystemBodySchema = z
  .object({
    authKey: z.string().min(1),
  })
  .readonly();
