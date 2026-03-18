import { KEY_ROTATION } from "@pluralscape/types";
import { z } from "zod";


export const InitiateRotationBodySchema = z.object({
  wrappedNewKey: z.string().min(1),
  newKeyVersion: z.number().int().min(2),
  friendKeyGrants: z.array(
    z.object({
      friendAccountId: z.string().min(1),
      encryptedKey: z.string().min(1),
    }),
  ),
});

export const ClaimChunkBodySchema = z.object({
  chunkSize: z
    .number()
    .int()
    .min(1)
    .max(KEY_ROTATION.maxChunkSize)
    .default(KEY_ROTATION.defaultChunkSize),
});

export const CompleteChunkBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        status: z.enum(["completed", "failed"]),
      }),
    )
    .min(1),
});
