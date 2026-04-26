import { NOTE_AUTHOR_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { HexColorSchema } from "./plaintext-shared.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE, MAX_QUERY_PARAM_STRING_LENGTH } from "./validation.constants.js";

// ── Encrypted input ─────────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption Note input.
 * Mirrors `NoteEncryptedInput =
 * Pick<Note, "title" | "content" | "backgroundColor">`.
 */
export const NoteEncryptedInputSchema = z
  .object({
    title: z.string().min(1),
    content: z.string(),
    backgroundColor: HexColorSchema.nullable(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateNoteBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    author: z
      .object({
        entityType: z.enum(NOTE_AUTHOR_ENTITY_TYPES),
        entityId: z.string().min(1),
      })
      .optional(),
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdateNoteBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const NoteQuerySchema = z
  .object({
    includeArchived: booleanQueryParam,
    authorEntityType: z.enum(NOTE_AUTHOR_ENTITY_TYPES).optional(),
    authorEntityId: z.string().max(MAX_QUERY_PARAM_STRING_LENGTH).optional(),
    systemWide: booleanQueryParam,
  })
  .refine((v) => v.authorEntityId === undefined || v.authorEntityType !== undefined, {
    message: "authorEntityId requires authorEntityType",
  })
  .refine(
    (v) => !v.systemWide || (v.authorEntityType === undefined && v.authorEntityId === undefined),
    { message: "systemWide cannot be combined with authorEntityType or authorEntityId" },
  );
