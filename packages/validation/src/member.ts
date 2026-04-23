import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import {
  HexColorSchema,
  PlaintextImageSourceSchema,
  PlaintextSaturationLevelSchema,
  PlaintextTagSchema,
} from "./plaintext-shared.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_MEMBER_DATA_SIZE } from "./validation.constants.js";

/**
 * Runtime validator for the pre-encryption Member input. Every field of
 * `MemberEncryptedInput` (in `@pluralscape/data`) must be present and
 * well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/member.type.test.ts`.
 *
 * Replaces the hand-written `assertMemberEncryptedFields` that used to live
 * in `packages/data/src/transforms/member.ts`.
 */
export const MemberEncryptedInputSchema = z
  .object({
    name: z.string().min(1),
    pronouns: z.array(z.string()).readonly(),
    description: z.string().nullable(),
    avatarSource: PlaintextImageSourceSchema.nullable(),
    colors: z.array(HexColorSchema).readonly(),
    saturationLevel: PlaintextSaturationLevelSchema,
    tags: z.array(PlaintextTagSchema).readonly(),
    suppressFriendFrontNotification: z.boolean(),
    boardMessageNotificationOnFront: z.boolean(),
  })
  .readonly();

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
