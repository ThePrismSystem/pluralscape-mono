import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { brandedNumber, brandedString } from "./branded.js";
import { PlaintextSaturationLevelSchema, PlaintextTagSchema } from "./plaintext-shared.js";
import { RELATIONSHIP_TYPES } from "./relationship.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type {
  SnapshotContent,
  SnapshotGroup,
  SnapshotInnerworldEntity,
  SnapshotInnerworldRegion,
  SnapshotMember,
  SnapshotRelationship,
  SnapshotStructureEntity,
  SnapshotStructureEntityType,
  SystemStructureEntityAssociation,
  SystemStructureEntityLink,
  SystemStructureEntityMemberLink,
} from "@pluralscape/types";

export const CreateSnapshotBodySchema = z
  .object({
    snapshotTrigger: z.enum(["manual", "scheduled-daily", "scheduled-weekly"]),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const DuplicateSystemBodySchema = z
  .object({
    snapshotId: brandedIdQueryParam("snap_"),
  })
  .readonly();

// ── Snapshot sub-types ────────────────────────────────────────────────

const SnapshotMemberSchema: z.ZodType<SnapshotMember> = z
  .object({
    id: brandedString<"MemberId">(),
    name: z.string(),
    pronouns: z.array(z.string()).readonly(),
    description: z.string().nullable(),
    tags: z.array(PlaintextTagSchema).readonly(),
    saturationLevel: PlaintextSaturationLevelSchema.nullable(),
    archived: z.boolean(),
  })
  .readonly();

const SnapshotStructureEntityTypeSchema: z.ZodType<SnapshotStructureEntityType> = z
  .object({
    id: brandedString<"SystemStructureEntityTypeId">(),
    name: z.string(),
    description: z.string().nullable(),
  })
  .readonly();

const SnapshotStructureEntitySchema: z.ZodType<SnapshotStructureEntity> = z
  .object({
    id: brandedString<"SystemStructureEntityId">(),
    entityTypeId: brandedString<"SystemStructureEntityTypeId">(),
    name: z.string(),
    description: z.string().nullable(),
  })
  .readonly();

const SnapshotRelationshipSchema: z.ZodType<SnapshotRelationship> = z
  .object({
    sourceMemberId: brandedString<"MemberId">(),
    targetMemberId: brandedString<"MemberId">(),
    type: z.enum(RELATIONSHIP_TYPES),
    bidirectional: z.boolean(),
    label: z.string().nullable(),
  })
  .readonly();

const SnapshotGroupSchema: z.ZodType<SnapshotGroup> = z
  .object({
    id: brandedString<"GroupId">(),
    name: z.string(),
    description: z.string().nullable(),
    parentGroupId: brandedString<"GroupId">().nullable(),
    memberIds: z.array(brandedString<"MemberId">()).readonly(),
  })
  .readonly();

const SnapshotInnerworldRegionSchema: z.ZodType<SnapshotInnerworldRegion> = z
  .object({
    id: brandedString<"InnerWorldRegionId">(),
    name: z.string(),
    description: z.string().nullable(),
    parentRegionId: brandedString<"InnerWorldRegionId">().nullable(),
  })
  .readonly();

const SnapshotInnerworldEntitySchema: z.ZodType<SnapshotInnerworldEntity> = z
  .object({
    id: brandedString<"InnerWorldEntityId">(),
    regionId: brandedString<"InnerWorldRegionId">().nullable(),
    entityType: z.enum(["member", "landmark", "structure-entity"]),
    name: z.string().nullable(),
  })
  .readonly();

// ── Junction-record schemas ───────────────────────────────────────────

const SystemStructureEntityLinkSchema: z.ZodType<SystemStructureEntityLink> = z
  .object({
    id: brandedString<"SystemStructureEntityLinkId">(),
    systemId: brandedString<"SystemId">(),
    entityId: brandedString<"SystemStructureEntityId">(),
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    sortOrder: z.number(),
    createdAt: brandedNumber<"UnixMillis">(),
  })
  .readonly();

const SystemStructureEntityMemberLinkSchema: z.ZodType<SystemStructureEntityMemberLink> = z
  .object({
    id: brandedString<"SystemStructureEntityMemberLinkId">(),
    systemId: brandedString<"SystemId">(),
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    memberId: brandedString<"MemberId">(),
    sortOrder: z.number(),
    createdAt: brandedNumber<"UnixMillis">(),
  })
  .readonly();

const SystemStructureEntityAssociationSchema: z.ZodType<SystemStructureEntityAssociation> = z
  .object({
    id: brandedString<"SystemStructureEntityAssociationId">(),
    systemId: brandedString<"SystemId">(),
    sourceEntityId: brandedString<"SystemStructureEntityId">(),
    targetEntityId: brandedString<"SystemStructureEntityId">(),
    createdAt: brandedNumber<"UnixMillis">(),
  })
  .readonly();

/**
 * Zod schema for `SnapshotContent` — the auxiliary type encrypted inside
 * a SystemSnapshot row's `encryptedData` blob. Per ADR-023 Class C convention,
 * this schema is named after the auxiliary type (no
 * `SystemSnapshotEncryptedInputSchema` alias). Parity test:
 * `__tests__/type-parity/system-snapshot.type.test.ts`.
 *
 * Currently a parity gate only — not yet wired to a runtime parse boundary.
 */
export const SnapshotContentSchema: z.ZodType<SnapshotContent> = z
  .object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    members: z.array(SnapshotMemberSchema).readonly(),
    structureEntityTypes: z.array(SnapshotStructureEntityTypeSchema).readonly(),
    structureEntities: z.array(SnapshotStructureEntitySchema).readonly(),
    structureEntityLinks: z.array(SystemStructureEntityLinkSchema).readonly(),
    structureEntityMemberLinks: z.array(SystemStructureEntityMemberLinkSchema).readonly(),
    structureEntityAssociations: z.array(SystemStructureEntityAssociationSchema).readonly(),
    relationships: z.array(SnapshotRelationshipSchema).readonly(),
    groups: z.array(SnapshotGroupSchema).readonly(),
    innerworldRegions: z.array(SnapshotInnerworldRegionSchema).readonly(),
    innerworldEntities: z.array(SnapshotInnerworldEntitySchema).readonly(),
  })
  .readonly();
