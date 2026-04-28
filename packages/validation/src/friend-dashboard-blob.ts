/**
 * Decrypt-boundary Zod schemas for friend-dashboard T2 blobs.
 *
 * Mirrors the `DecryptedDashboard*` interfaces in
 * `packages/data/src/transforms/friend-dashboard.ts`. The plaintext returned
 * from the AEAD cipher is `unknown`; calling `Schema.parse` here turns it
 * into a typed, validated record before any consumer reads it.
 *
 * Matches the post-types-emid fleet pattern: every decrypt site validates
 * with Zod, no hand-rolled `assertObjectBlob` / `assertStringField` helpers.
 */
import { z } from "zod/v4";

import { HexColorSchema, PlaintextImageSourceSchema } from "./plaintext-shared.js";

/** Friend-dashboard member plaintext shape. Mirrors `DecryptedDashboardMember` minus `id`. */
export const FriendDashboardMemberBlobSchema = z.object({
  name: z.string(),
  pronouns: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  colors: z.array(HexColorSchema.nullable()).optional(),
});

/**
 * Friend-dashboard fronting session plaintext shape. Mirrors
 * `DecryptedDashboardFrontingSession` minus structural columns.
 */
export const FriendDashboardFrontingSessionBlobSchema = z.object({
  comment: z.string().nullable().optional(),
  positionality: z.string().nullable().optional(),
  outtrigger: z.string().nullable().optional(),
  outtriggerSentiment: z.enum(["negative", "neutral", "positive"]).nullable().optional(),
});

/** Friend-dashboard custom front plaintext shape. Mirrors `DecryptedDashboardCustomFront` minus `id`. */
export const FriendDashboardCustomFrontBlobSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  color: HexColorSchema.nullable().optional(),
  emoji: z.string().nullable().optional(),
});

/**
 * Friend-dashboard structure entity plaintext shape. Mirrors
 * `DecryptedDashboardStructureEntity` minus `id`.
 */
export const FriendDashboardStructureEntityBlobSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  color: HexColorSchema.nullable().optional(),
  imageSource: PlaintextImageSourceSchema.nullable().optional(),
});

export type FriendDashboardMemberBlob = z.infer<typeof FriendDashboardMemberBlobSchema>;
export type FriendDashboardFrontingSessionBlob = z.infer<
  typeof FriendDashboardFrontingSessionBlobSchema
>;
export type FriendDashboardCustomFrontBlob = z.infer<typeof FriendDashboardCustomFrontBlobSchema>;
export type FriendDashboardStructureEntityBlob = z.infer<
  typeof FriendDashboardStructureEntityBlobSchema
>;
