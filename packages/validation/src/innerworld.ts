import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

export const CreateRegionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentRegionId: brandedString<"InnerWorldRegionId">().nullable().optional(),
  })
  .readonly();

export const UpdateRegionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const CreateEntityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    regionId: brandedString<"InnerWorldRegionId">().nullable().optional(),
  })
  .readonly();

export const UpdateEntityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const UpdateCanvasBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();
