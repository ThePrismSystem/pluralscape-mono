import { z } from "zod/v4";

import { HexColorSchema } from "./plaintext-shared.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

/**
 * Runtime validator for the pre-encryption CustomFront input. Every field
 * of `CustomFrontEncryptedInput` (in `@pluralscape/data`) must be present
 * and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/custom-front.type.test.ts`.
 */
export const CustomFrontEncryptedInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    color: HexColorSchema.nullable(),
    emoji: z.string().nullable(),
  })
  .readonly();

export const CreateCustomFrontBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const UpdateCustomFrontBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();
