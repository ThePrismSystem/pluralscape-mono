import { ALL_API_KEY_SCOPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE, PUBLIC_KEY_BYTE_LENGTH } from "./validation.constants.js";

import type { ApiKeyEncryptedPayload } from "@pluralscape/types";

/** Key types matching the DB enum constraint. */
const API_KEY_KEY_TYPES = ["metadata", "crypto"] as const;

export const CreateApiKeyBodySchema = z
  .object({
    keyType: z.enum(API_KEY_KEY_TYPES),
    scopes: z.array(z.enum(ALL_API_KEY_SCOPES)).min(1),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    encryptedKeyMaterial: z.string().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    scopedBucketIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) =>
      (data.keyType === "crypto" && data.encryptedKeyMaterial !== undefined) ||
      (data.keyType === "metadata" && data.encryptedKeyMaterial === undefined),
    {
      message: "encryptedKeyMaterial is required for crypto keys and forbidden for metadata keys",
      path: ["encryptedKeyMaterial"],
    },
  )
  .readonly();

// ── ApiKeyEncryptedPayload codec ──────────────────────────────────────
//
// Class C auxiliary type encrypted inside an ApiKey row's `encryptedData`
// blob. Wire side: publicKey is a base64 string (what JSON.parse produces).
// Memory side: publicKey is a 32-byte Uint8Array (what crypto operations
// consume). `z.encode(...)` runs memory → wire (used at the encrypt
// boundary, before JSON.stringify); `z.decode(...)` runs wire → memory
// (used at the decrypt boundary, after JSON.parse).
// Parity test: `__tests__/type-parity/api-key.type.test.ts` asserts
// `z.output<typeof ApiKeyEncryptedPayloadSchema>` ≡ `ApiKeyEncryptedPayload`.

const ApiKeyEncryptedPayloadWireSchema = z.discriminatedUnion("keyType", [
  z
    .object({
      keyType: z.literal("metadata"),
      name: z.string().min(1),
    })
    .readonly(),
  z
    .object({
      keyType: z.literal("crypto"),
      name: z.string().min(1),
      publicKey: z.base64(),
    })
    .readonly(),
]);

const ApiKeyEncryptedPayloadMemorySchema = z.discriminatedUnion("keyType", [
  z
    .object({
      keyType: z.literal("metadata"),
      name: z.string().min(1),
    })
    .readonly(),
  z
    .object({
      keyType: z.literal("crypto"),
      name: z.string().min(1),
      // z.custom<Uint8Array> (not z.instanceof) — z.instanceof yields
      // InstanceType<typeof Uint8Array> which breaks Equal<> parity in the
      // type-parity test. Runtime check is identical (instanceof Uint8Array).
      publicKey: z
        .custom<Uint8Array>((v) => v instanceof Uint8Array)
        .refine(
          (buf) => buf.length === PUBLIC_KEY_BYTE_LENGTH,
          "publicKey must be 32 bytes (X25519)",
        ),
    })
    .readonly(),
]) satisfies z.ZodType<ApiKeyEncryptedPayload>;

export const ApiKeyEncryptedPayloadSchema = z.codec(
  ApiKeyEncryptedPayloadWireSchema,
  ApiKeyEncryptedPayloadMemorySchema,
  {
    decode: (wire) =>
      wire.keyType === "crypto"
        ? { ...wire, publicKey: z.util.base64ToUint8Array(wire.publicKey) }
        : wire,
    encode: (memory) =>
      memory.keyType === "crypto"
        ? { ...memory, publicKey: z.util.uint8ArrayToBase64(memory.publicKey) }
        : memory,
  },
);
