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

// ── Cross-Structure Links ────────────────────────────────────────────

export const CreateSubsystemLayerLinkBodySchema = z
  .object({
    subsystemId: brandedString<"SubsystemId">(),
    layerId: brandedString<"LayerId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();

export const CreateSubsystemSideSystemLinkBodySchema = z
  .object({
    subsystemId: brandedString<"SubsystemId">(),
    sideSystemId: brandedString<"SideSystemId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();

export const CreateSideSystemLayerLinkBodySchema = z
  .object({
    sideSystemId: brandedString<"SideSystemId">(),
    layerId: brandedString<"LayerId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();
