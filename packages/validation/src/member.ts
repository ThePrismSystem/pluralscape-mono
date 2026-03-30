import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_MEMBER_DATA_SIZE } from "./validation.constants.js";

export const CreateMemberBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_MEMBER_DATA_SIZE),
  })
  .readonly();

export const UpdateMemberBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_MEMBER_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const DuplicateMemberBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_MEMBER_DATA_SIZE),
    copyPhotos: z.boolean().default(false),
    copyFields: z.boolean().default(false),
    copyMemberships: z.boolean().default(false),
  })
  .readonly();

/**
 * Query parameters for the member list endpoint.
 * Supports filtering by group membership and archived status.
 */
export const MemberListQuerySchema = z.object({
  groupId: brandedIdQueryParam("grp_").optional(),
  includeArchived: booleanQueryParam,
});
