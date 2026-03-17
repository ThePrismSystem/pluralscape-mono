import { z } from "zod/v4";

import { MAX_ENCRYPTED_GROUP_DATA_SIZE, MAX_REORDER_OPERATIONS } from "./validation.constants.js";

export const CreateGroupBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_GROUP_DATA_SIZE),
    parentGroupId: z.string().min(1).nullable(),
    sortOrder: z.int().min(0),
  })
  .readonly();

export const UpdateGroupBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_GROUP_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const MoveGroupBodySchema = z
  .object({
    targetParentGroupId: z.string().min(1).nullable(),
    version: z.int().min(1),
  })
  .readonly();

export const ReorderGroupsBodySchema = z
  .object({
    operations: z
      .array(
        z.object({
          groupId: z.string().min(1),
          sortOrder: z.int().min(0),
        }),
      )
      .min(1)
      .max(MAX_REORDER_OPERATIONS),
  })
  .readonly();

export const AddGroupMemberBodySchema = z
  .object({
    memberId: z.string().min(1),
  })
  .readonly();
