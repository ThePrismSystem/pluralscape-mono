import { FIELD_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import {
  MAX_ENCRYPTED_FIELD_DATA_SIZE,
  MAX_ENCRYPTED_FIELD_VALUE_SIZE,
} from "./validation.constants.js";

import type { FieldDefinition, FieldDefinitionEncryptedFields } from "@pluralscape/types";

const FieldTypeSchema = z.enum(FIELD_TYPES);

/**
 * Runtime validator for the pre-encryption FieldDefinition input. Every
 * field of `FieldDefinitionEncryptedInput` (in `@pluralscape/data`) must
 * be present and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/custom-fields.type.test.ts`.
 */
export const FieldDefinitionEncryptedInputSchema = z
  .object({
    name: brandedString<"FieldDefinitionLabel">(),
    description: z.string().nullable(),
    options: z.array(z.string()).readonly().nullable(),
  })
  .readonly() satisfies z.ZodType<Pick<FieldDefinition, FieldDefinitionEncryptedFields>>;

/**
 * Runtime validator for the pre-encryption FieldValue input. The
 * encrypted blob carries the full discriminated `FieldValueUnion`
 * (`{fieldType, value}`); the schema mirrors each arm. Zod compile-time
 * parity is checked against the union in
 * `__tests__/type-parity/custom-fields.type.test.ts`.
 */
export const FieldValueEncryptedInputSchema = z.discriminatedUnion("fieldType", [
  z.object({ fieldType: z.literal("text"), value: z.string() }).readonly(),
  z.object({ fieldType: z.literal("number"), value: z.number() }).readonly(),
  z.object({ fieldType: z.literal("boolean"), value: z.boolean() }).readonly(),
  z.object({ fieldType: z.literal("date"), value: z.string() }).readonly(),
  z.object({ fieldType: z.literal("color"), value: z.string() }).readonly(),
  z.object({ fieldType: z.literal("select"), value: z.string() }).readonly(),
  z
    .object({ fieldType: z.literal("multi-select"), value: z.array(z.string()).readonly() })
    .readonly(),
  z.object({ fieldType: z.literal("url"), value: z.string() }).readonly(),
]);

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
