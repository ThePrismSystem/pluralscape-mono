import { POLL_KINDS } from "@pluralscape/types";
import { z } from "zod/v4";

import { optionalBrandedId } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

/** Allowed voter entity types for poll votes. */
export const POLL_VOTER_ENTITY_TYPES = ["member", "structure-entity"] as const;

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
    optionId: z.string().min(1).nullable().optional(),
    voter: z.object({
      entityType: z.enum(POLL_VOTER_ENTITY_TYPES),
      entityId: z.string().min(1),
    }),
    isVeto: z.boolean().optional().default(false),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const PollQuerySchema = z.object({
  includeArchived: booleanQueryParam,
  status: z.enum(["open", "closed"]).optional(),
});

export const PollVoteQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
