import { z } from "zod/v4";

import { authKeyHex } from "./auth.js";

export const PurgeSystemBodySchema = z
  .object({
    authKey: authKeyHex,
  })
  .readonly();
