import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Structure Memberships ────────────────────────────────────────────

export const AddStructureMembershipBodySchema = z
  .object({
    memberId: brandedString<"MemberId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

// ── Structure Entity Links ───────────────────────────────────────────

export const CreateStructureEntityLinkBodySchema = z
  .object({
    sourceEntityId: brandedString<"SystemStructureEntityId">(),
    targetEntityId: brandedString<"SystemStructureEntityId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();

// ── Structure Entity Member Links ───────────────────────────────────

export const CreateStructureEntityMemberLinkBodySchema = z
  .object({
    structureEntityId: brandedString<"SystemStructureEntityId">(),
    memberId: brandedString<"MemberId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

// ── Structure Entity Associations ───────────────────────────────────

export const CreateStructureEntityAssociationBodySchema = z
  .object({
    sourceEntityId: brandedString<"SystemStructureEntityId">(),
    targetEntityId: brandedString<"SystemStructureEntityId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();
