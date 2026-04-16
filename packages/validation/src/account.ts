import { z } from "zod/v4";

import { authKeyHex } from "./auth.js";

export const DeleteAccountBodySchema = z
  .object({
    authKey: authKeyHex,
  })
  .readonly();
