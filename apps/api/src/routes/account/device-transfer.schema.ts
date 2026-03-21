/**
 * Zod request body schemas for device transfer routes.
 * Domain: device transfer initiation and completion validation.
 */
import {
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  HEX_CHARS_PER_BYTE,
  PWHASH_SALT_BYTES,
} from "@pluralscape/crypto";
import { z } from "zod";

/** Pattern for valid lowercase or uppercase hex strings. */
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Maximum byte length for encrypted key material.
 * 1 KiB is generous for a wrapped master key (typically ~80 bytes).
 */
const MAX_ENCRYPTED_KEY_MATERIAL_BYTES = 1024;

/** Minimum byte length for encrypted key material: nonce (24) + AEAD tag (16). */
const MIN_ENCRYPTED_KEY_MATERIAL_BYTES = AEAD_NONCE_BYTES + AEAD_TAG_BYTES;

/** Hex string length for the code salt (PWHASH_SALT_BYTES * 2 hex chars per byte). */
const CODE_SALT_HEX_LENGTH = PWHASH_SALT_BYTES * HEX_CHARS_PER_BYTE;

/** Hex string for a fixed-size salt: must be exactly CODE_SALT_HEX_LENGTH hex chars. */
const codeSaltHex = z
  .string()
  .length(
    CODE_SALT_HEX_LENGTH,
    `codeSaltHex must be exactly ${String(CODE_SALT_HEX_LENGTH)} hex characters`,
  )
  .regex(HEX_PATTERN, "codeSaltHex must be a valid hex string")
  .transform((v) => v.toLowerCase());

/** Hex string for encrypted key material with min/max byte-length bounds. */
const encryptedKeyMaterialHex = z
  .string()
  .min(
    MIN_ENCRYPTED_KEY_MATERIAL_BYTES * HEX_CHARS_PER_BYTE,
    `encryptedKeyMaterialHex must be at least ${String(MIN_ENCRYPTED_KEY_MATERIAL_BYTES * HEX_CHARS_PER_BYTE)} hex characters`,
  )
  .max(
    MAX_ENCRYPTED_KEY_MATERIAL_BYTES * HEX_CHARS_PER_BYTE,
    `encryptedKeyMaterialHex must be at most ${String(MAX_ENCRYPTED_KEY_MATERIAL_BYTES * HEX_CHARS_PER_BYTE)} hex characters`,
  )
  .regex(HEX_PATTERN, "encryptedKeyMaterialHex must be a valid hex string")
  .refine((v) => v.length % HEX_CHARS_PER_BYTE === 0, {
    message: "encryptedKeyMaterialHex must have even length (whole bytes)",
  })
  .transform((v) => v.toLowerCase());

/** Transfer code: exactly 8 decimal digits. */
const TRANSFER_CODE_DIGIT_COUNT = 8;

const code = z
  .string()
  .length(
    TRANSFER_CODE_DIGIT_COUNT,
    `code must be exactly ${String(TRANSFER_CODE_DIGIT_COUNT)} digits`,
  )
  .regex(/^\d+$/, "code must contain only decimal digits");

/** Schema for POST /device-transfer (initiate). */
export const initiateTransferBodySchema = z.object({
  codeSaltHex,
  encryptedKeyMaterialHex,
});

/** Schema for POST /device-transfer/:id/complete. */
export const completeTransferBodySchema = z.object({
  code,
});
