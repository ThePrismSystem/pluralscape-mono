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
  "structure-entity-formation",
  "form-change",
  "name-change",
  "structure-move",
  "innerworld-move",
] as const;

export { LIFECYCLE_EVENT_TYPES };

// ── Per-event-type plaintext metadata schemas ─────────────────────

const memberIdArray = z.array(brandedString<"MemberId">()).min(1);
const structureIdArray = z.array(brandedString<"SystemStructureEntityId">()).min(1);
const entityIdArray = z.array(brandedString<"InnerWorldEntityId">()).min(1);
const regionIdArray = z.array(brandedString<"InnerWorldRegionId">()).min(1);

const SingleMemberMetadataSchema = z.object({
  memberIds: memberIdArray.length(1),
});

const TwoOrMoreMembersMetadataSchema = z.object({
  memberIds: memberIdArray.min(2),
});

const MergeMetadataSchema = z.object({
  memberIds: memberIdArray.length(2),
});

const StructureEntityFormationMetadataSchema = z.object({
  structureIds: structureIdArray.length(1),
});

const StructureMoveMetadataSchema = z.object({
  memberIds: memberIdArray.length(1),
  structureIds: z.array(brandedString<"SystemStructureEntityId">()).length(2),
});

const InnerworldMoveMetadataSchema = z.object({
  entityIds: entityIdArray.length(1),
  regionIds: regionIdArray.max(2),
});

const METADATA_SCHEMAS: Record<(typeof LIFECYCLE_EVENT_TYPES)[number], z.ZodType> = {
  discovery: SingleMemberMetadataSchema,
  split: TwoOrMoreMembersMetadataSchema,
  fusion: TwoOrMoreMembersMetadataSchema,
  merge: MergeMetadataSchema,
  unmerge: TwoOrMoreMembersMetadataSchema,
  "dormancy-start": SingleMemberMetadataSchema,
  "dormancy-end": SingleMemberMetadataSchema,
  archival: SingleMemberMetadataSchema,
  "form-change": SingleMemberMetadataSchema,
  "name-change": SingleMemberMetadataSchema,
  "structure-entity-formation": StructureEntityFormationMetadataSchema,
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

// ── Per-variant encrypted-input schemas ───────────────────────────
// The discriminator (`eventType`) is plaintext on the wire, not inside
// the blob, so `z.discriminatedUnion` is not applicable here. The
// transform selects the per-variant schema via LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS
// keyed on `raw.eventType`.

const baseEncrypted = { notes: z.string().nullable() } as const;

const SplitEncryptedSchema = z.object(baseEncrypted).readonly();
const FusionEncryptedSchema = z.object(baseEncrypted).readonly();
const MergeEncryptedSchema = z.object(baseEncrypted).readonly();
const UnmergeEncryptedSchema = z.object(baseEncrypted).readonly();
const DiscoveryEncryptedSchema = z.object(baseEncrypted).readonly();
const StructureEntityFormationEncryptedSchema = z.object(baseEncrypted).readonly();
const StructureMoveEncryptedSchema = z.object(baseEncrypted).readonly();

const DormancyStartEncryptedSchema = z
  .object({
    ...baseEncrypted,
    relatedLifecycleEventId: brandedString<"LifecycleEventId">().nullable(),
  })
  .readonly();

const DormancyEndEncryptedSchema = z
  .object({
    ...baseEncrypted,
    relatedLifecycleEventId: brandedString<"LifecycleEventId">().nullable(),
  })
  .readonly();

const ArchivalEncryptedSchema = z
  .object({
    ...baseEncrypted,
    entity: z
      .object({
        entityType: z.string(),
        entityId: z.string(),
      })
      .readonly(),
  })
  .readonly();

const FormChangeEncryptedSchema = z
  .object({
    ...baseEncrypted,
    previousForm: z.string().nullable(),
    newForm: z.string().nullable(),
  })
  .readonly();

const NameChangeEncryptedSchema = z
  .object({
    ...baseEncrypted,
    previousName: z.string().nullable(),
    newName: z.string(),
  })
  .readonly();

const InnerworldMoveEncryptedSchema = z
  .object({
    ...baseEncrypted,
    entityType: z.enum(["member", "landmark", "structure-entity"]),
  })
  .readonly();

/** Union of all per-variant encrypted-input shapes. */
export const LifecycleEventEncryptedInputSchema = z.union([
  SplitEncryptedSchema,
  FusionEncryptedSchema,
  MergeEncryptedSchema,
  UnmergeEncryptedSchema,
  DormancyStartEncryptedSchema,
  DormancyEndEncryptedSchema,
  DiscoveryEncryptedSchema,
  ArchivalEncryptedSchema,
  StructureEntityFormationEncryptedSchema,
  FormChangeEncryptedSchema,
  NameChangeEncryptedSchema,
  StructureMoveEncryptedSchema,
  InnerworldMoveEncryptedSchema,
]);

/**
 * Map of `eventType` → per-variant Zod schema, used by the transform to
 * select the correct schema before parsing the decrypted blob.
 */
export const LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS = {
  split: SplitEncryptedSchema,
  fusion: FusionEncryptedSchema,
  merge: MergeEncryptedSchema,
  unmerge: UnmergeEncryptedSchema,
  "dormancy-start": DormancyStartEncryptedSchema,
  "dormancy-end": DormancyEndEncryptedSchema,
  discovery: DiscoveryEncryptedSchema,
  archival: ArchivalEncryptedSchema,
  "structure-entity-formation": StructureEntityFormationEncryptedSchema,
  "form-change": FormChangeEncryptedSchema,
  "name-change": NameChangeEncryptedSchema,
  "structure-move": StructureMoveEncryptedSchema,
  "innerworld-move": InnerworldMoveEncryptedSchema,
} as const;

// ── Plaintext metadata schema (loose for body validation) ─────────

const PlaintextMetadataSchema = z.object({
  memberIds: z.array(brandedString<"MemberId">()).optional(),
  structureIds: z.array(brandedString<"SystemStructureEntityId">()).optional(),
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

export const UpdateLifecycleEventBodySchema = z
  .object({
    eventType: z.enum(LIFECYCLE_EVENT_TYPES).optional(),
    occurredAt: z.int().min(0).optional(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    plaintextMetadata: PlaintextMetadataSchema.optional(),
    version: z.int().min(1),
  })
  .readonly();
