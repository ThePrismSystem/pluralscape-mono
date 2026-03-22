import { z } from "zod/v4";

import { brandedString } from "./branded.js";

// ── Structure Entity Links ───────────────────────────────────────────

export const CreateStructureEntityLinkBodySchema = z
  .object({
    entityId: brandedString<"SystemStructureEntityId">(),
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    sortOrder: z.int().min(0),
  })
  .readonly();

// ── Structure Entity Member Links ───────────────────────────────────

export const CreateStructureEntityMemberLinkBodySchema = z
  .object({
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    memberId: brandedString<"MemberId">(),
    sortOrder: z.int().min(0),
  })
  .readonly();

// ── Structure Entity Associations ───────────────────────────────────

export const CreateStructureEntityAssociationBodySchema = z
  .object({
    sourceEntityId: brandedString<"SystemStructureEntityId">(),
    targetEntityId: brandedString<"SystemStructureEntityId">(),
  })
  .readonly();
