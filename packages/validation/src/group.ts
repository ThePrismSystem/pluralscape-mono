import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE, MAX_REORDER_OPERATIONS } from "./validation.constants.js";

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

export const AddGroupMemberBodySchema = z
  .object({
    memberId: brandedString<"MemberId">(),
  })
  .readonly();
