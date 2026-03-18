import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

const LIFECYCLE_EVENT_TYPES = [
  "split",
  "fusion",
  "merge",
  "unmerge",
  "dormancy-start",
  "dormancy-end",
  "discovery",
  "archival",
  "subsystem-formation",
  "form-change",
  "name-change",
  "structure-move",
  "innerworld-move",
] as const;

export { LIFECYCLE_EVENT_TYPES };

// ── Per-event-type plaintext metadata schemas ─────────────────────

const memberIdArray = z.array(brandedString<"MemberId">()).min(1);
const structureIdArray = z.array(brandedString<"SubsystemId">()).min(1);
const entityIdArray = z.array(brandedString<"InnerWorldEntityId">()).min(1);
const regionIdArray = z.array(brandedString<"InnerWorldRegionId">());

const DiscoveryMetadataSchema = z.object({
  memberIds: memberIdArray.length(1),
});

const SplitMetadataSchema = z.object({
  memberIds: memberIdArray.min(2),
});

const FusionMetadataSchema = z.object({
  memberIds: memberIdArray.min(2),
});

const MergeMetadataSchema = z.object({
  memberIds: memberIdArray.length(2),
});

const UnmergeMetadataSchema = z.object({
  memberIds: memberIdArray.min(2),
});

const SingleMemberMetadataSchema = z.object({
  memberIds: memberIdArray.length(1),
});

const SubsystemFormationMetadataSchema = z.object({
  structureIds: structureIdArray.length(1),
});

const StructureMoveMetadataSchema = z.object({
  memberIds: memberIdArray.length(1),
  structureIds: z.array(brandedString<"SubsystemId">()).length(2),
});

const InnerworldMoveMetadataSchema = z.object({
  entityIds: entityIdArray.length(1),
  regionIds: regionIdArray.min(1).max(2),
});

const METADATA_SCHEMAS: Record<(typeof LIFECYCLE_EVENT_TYPES)[number], z.ZodType> = {
  discovery: DiscoveryMetadataSchema,
  split: SplitMetadataSchema,
  fusion: FusionMetadataSchema,
  merge: MergeMetadataSchema,
  unmerge: UnmergeMetadataSchema,
  "dormancy-start": SingleMemberMetadataSchema,
  "dormancy-end": SingleMemberMetadataSchema,
  archival: SingleMemberMetadataSchema,
  "form-change": SingleMemberMetadataSchema,
  "name-change": SingleMemberMetadataSchema,
  "subsystem-formation": SubsystemFormationMetadataSchema,
  "structure-move": StructureMoveMetadataSchema,
  "innerworld-move": InnerworldMoveMetadataSchema,
};

export function validateLifecycleMetadata(
  eventType: (typeof LIFECYCLE_EVENT_TYPES)[number],
  metadata: unknown,
): z.ZodSafeParseResult<unknown> {
  const schema = METADATA_SCHEMAS[eventType];
  return schema.safeParse(metadata);
}

// ── Plaintext metadata schema (loose for body validation) ─────────

const PlaintextMetadataSchema = z.object({
  memberIds: z.array(brandedString<"MemberId">()).optional(),
  structureIds: z.array(brandedString<"SubsystemId">()).optional(),
  entityIds: z.array(brandedString<"InnerWorldEntityId">()).optional(),
  regionIds: z.array(brandedString<"InnerWorldRegionId">()).optional(),
});

export type PlaintextMetadata = z.infer<typeof PlaintextMetadataSchema>;

// ── Body schema ───────────────────────────────────────────────────

export const CreateLifecycleEventBodySchema = z
  .object({
    eventType: z.enum(LIFECYCLE_EVENT_TYPES),
    occurredAt: z.int().min(0),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    plaintextMetadata: PlaintextMetadataSchema.optional(),
  })
  .readonly();
