import { FIELD_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import {
  MAX_ENCRYPTED_FIELD_DATA_SIZE,
  MAX_ENCRYPTED_FIELD_VALUE_SIZE,
} from "./validation.constants.js";

const FieldTypeSchema = z.enum(FIELD_TYPES);

export const CreateFieldDefinitionBodySchema = z
  .object({
    fieldType: FieldTypeSchema,
    required: z.boolean().default(false),
    sortOrder: z.int().min(0).default(0),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_FIELD_DATA_SIZE),
  })
  .readonly();

export const UpdateFieldDefinitionBodySchema = z
  .object({
    required: z.boolean().optional(),
    sortOrder: z.int().min(0).optional(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_FIELD_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const SetFieldValueBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_FIELD_VALUE_SIZE),
  })
  .readonly();

export const UpdateFieldValueBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_FIELD_VALUE_SIZE),
    version: z.int().min(1),
  })
  .readonly();
