import { POLL_KINDS, POLL_STATUSES } from "@pluralscape/types";
import { z } from "zod/v4";

import { optionalBrandedId } from "./branded-id.js";
import { brandedString } from "./branded.js";
import { HexColorSchema } from "./plaintext-shared.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

/** Allowed voter entity types for poll votes. */
export const POLL_VOTER_ENTITY_TYPES = ["member", "structure-entity"] as const;

// ── Encrypted input ─────────────────────────────────────────────

const PollOptionSchema = z
  .object({
    id: brandedString<"PollOptionId">(),
    label: brandedString<"PollOptionLabel">(),
    voteCount: z.number().int().min(0),
    color: HexColorSchema.nullable(),
    emoji: z.string().nullable(),
  })
  .readonly();

/**
 * Runtime validator for the pre-encryption Poll input.
 * Mirrors `PollEncryptedInput =
 * Pick<Poll, "title" | "description" | "options">`.
 */
export const PollEncryptedInputSchema = z
  .object({
    title: brandedString<"PollTitle">(),
    description: z.string().nullable(),
    options: z.array(PollOptionSchema).readonly(),
  })
  .readonly();

/**
 * Runtime validator for the pre-encryption PollVote input.
 * Mirrors `PollVoteEncryptedInput = Pick<PollVote, "comment">`.
 */
export const PollVoteEncryptedInputSchema = z
  .object({
    comment: z.string().nullable(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreatePollBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    kind: z.enum(POLL_KINDS),
    createdByMemberId: optionalBrandedId("mem_"),
    allowMultipleVotes: z.boolean(),
    maxVotesPerMember: z.int().min(1),
    allowAbstain: z.boolean(),
    allowVeto: z.boolean(),
    endsAt: z.number().int().positive().optional(),
  })
  .refine((data) => data.allowMultipleVotes || data.maxVotesPerMember === 1, {
    message: "maxVotesPerMember must be 1 when allowMultipleVotes is false",
    path: ["maxVotesPerMember"],
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdatePollBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── Cast Vote ───────────────────────────────────────────────────

export const CastVoteBodySchema = z
  .object({
    optionId: z.string().min(1).nullable(),
    voter: z.object({
      entityType: z.enum(POLL_VOTER_ENTITY_TYPES),
      entityId: z.string().min(1),
    }),
    isVeto: z.boolean().optional().default(false),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

// ── Update Vote ────────────────────────────────────────────────

export const UpdatePollVoteBodySchema = z
  .object({
    optionId: z.string().min(1).nullable(),
    isVeto: z.boolean().optional(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const PollQuerySchema = z.object({
  includeArchived: booleanQueryParam,
  status: z.enum(POLL_STATUSES).optional(),
});

export const PollVoteQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
