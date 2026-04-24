import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { HexColorSchema, PlaintextImageSourceSchema } from "./plaintext-shared.js";
import { MAX_ENCRYPTED_DATA_SIZE, MAX_REORDER_OPERATIONS } from "./validation.constants.js";

/**
 * Runtime validator for the pre-encryption Group input. Every field of
 * `GroupEncryptedInput` (in `@pluralscape/data`) must be present and
 * well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/group.type.test.ts`.
 */
export const GroupEncryptedInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    imageSource: PlaintextImageSourceSchema.nullable(),
    color: HexColorSchema.nullable(),
    emoji: z.string().nullable(),
  })
  .readonly();

export const CreateGroupBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentGroupId: brandedString<"GroupId">().nullable(),
    sortOrder: z.int().min(0),
  })
  .readonly();

export const UpdateGroupBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const MoveGroupBodySchema = z
  .object({
    targetParentGroupId: brandedString<"GroupId">().nullable(),
    version: z.int().min(1),
  })
  .readonly();

export const ReorderGroupsBodySchema = z
  .object({
    operations: z
      .array(
        z.object({
          groupId: brandedString<"GroupId">(),
          sortOrder: z.int().min(0),
        }),
      )
      .min(1)
      .max(MAX_REORDER_OPERATIONS),
  })
  .readonly();

export const CopyGroupBodySchema = z
  .object({
    targetParentGroupId: brandedString<"GroupId">().nullable().optional(),
    copyMemberships: z.boolean().optional().default(false),
  })
  .readonly();

export const AddGroupMemberBodySchema = z
  .object({
    memberId: brandedString<"MemberId">(),
  })
  .readonly();
