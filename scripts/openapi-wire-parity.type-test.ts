/**
 * Compile-time-only OpenAPI-Wire parity check for the types-ltel pilot.
 *
 * Asserts that OpenAPI-generated response types from `@pluralscape/api-client`
 * structurally equal their corresponding `<Entity>Wire` types from
 * `@pluralscape/types`.
 *
 * Typechecked via `pnpm types:check-sot`.
 *
 * ── Scope ────────────────────────────────────────────────────────────
 *
 * Every `<X>Response` has two parts:
 *  1. The opaque `encryptedData` field — `string` on the wire but a
 *     structured `EncryptedBlob` discriminated union in the domain. The
 *     asymmetry is at an encode/decode boundary that cannot be
 *     structurally equated.
 *  2. Every OTHER field (plaintext columns the server sees) — ids,
 *     timestamps, `version`, `archived`/`archivedAt`, plus per-entity
 *     denormalized additions (e.g. `FrontingSessionResponse.structureEntityId`).
 *     These ARE fully structurally assertable.
 *
 * Per-entity plaintext-column parity therefore takes a split form — see
 * the Member block below. This is the canonical fleet pattern: every
 * renamed entity replicates the split (`Omit<..., "encryptedData">`
 * equality + `<X>Response["encryptedData"] extends string`).
 *
 * The shared `EncryptedEntity` envelope parity serves as the canonical
 * tripwire for the envelope shape itself (the set of plaintext columns
 * every T1 response rides on). If the envelope drifts, every per-entity
 * assertion will also trip — the envelope check localizes the diagnosis.
 *
 * `AuditLogEntry` is plaintext on the wire (not encrypted), so the
 * OpenAPI schema structurally matches the domain type directly via
 * `Equal<components["schemas"]["AuditLogEntry"], Serialize<AuditLogEntry>>`.
 *
 * What this file enforces:
 *  - `MemberWire ≡ Serialize<Member>` (self-consistency of the helper).
 *  - `AuditLogEntryWire ≡ Serialize<AuditLogEntry>` (same).
 *  - `components["schemas"]["EncryptedEntity"]` structurally equals the
 *    hand-authored `EncryptedEntityWire` mirror below — canonical envelope
 *    tripwire.
 *  - `MemberResponse` plaintext columns (split parity, see Member block).
 *  - `components["schemas"]["PlaintextMember"]` structurally equals
 *    `Serialize<Pick<Member, MemberEncryptedFields>>` — the pre-encryption
 *    contract derived directly from the domain.
 *  - `components["schemas"]["AuditLogEntry"]` structurally equals
 *    `Serialize<AuditLogEntry>` — plaintext-wire parity for the audit log.
 *  - `PlaintextX` parity for every fleet-renamed entity.
 *
 * Adding a bogus field on either side of any assertion will fail the gate
 * — see `pnpm types:check-sot`.
 */

import type { components } from "../packages/api-client/src/generated/api-types.js";
import type {
  AuditLogEntry,
  AuditLogEntryWire,
  CustomFront,
  CustomFrontEncryptedFields,
  CustomFrontServerMetadata,
  Equal,
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldDefinitionServerMetadata,
  FieldValue,
  FieldValueEncryptedFields,
  FieldValueServerMetadata,
  FrontingSession,
  FrontingSessionEncryptedFields,
  Group,
  GroupEncryptedFields,
  GroupServerMetadata,
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedFields,
  InnerWorldCanvasServerMetadata,
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields,
  InnerWorldEntityServerMetadata,
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields,
  InnerWorldRegionServerMetadata,
  LifecycleEvent,
  LifecycleEventEncryptedFields,
  Member,
  MemberEncryptedFields,
  MemberPhoto,
  MemberPhotoEncryptedFields,
  MemberServerMetadata,
  MemberWire,
  NomenclatureEncryptedFields,
  NomenclatureSettings,
  Relationship,
  RelationshipEncryptedFields,
  Serialize,
  System,
  SystemEncryptedFields,
  SystemSettings,
  SystemSettingsEncryptedFields,
  SystemStructureEntity,
  SystemStructureEntityAssociation,
  SystemStructureEntityAssociationEncryptedFields,
  SystemStructureEntityEncryptedFields,
  SystemStructureEntityMemberLink,
  SystemStructureEntityMemberLinkEncryptedFields,
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
} from "../packages/types/src/index.js";
import { expectTypeOf } from "vitest";

// ── Wire helpers self-consistency ────────────────────────────────────
//
// `<Entity>Wire` must equal `Serialize<Entity>` — no hand-authored drift
// from the helper-derived form. This bites if someone hand-redefines
// `MemberWire` to diverge from `Serialize<Member>`.

expectTypeOf<Equal<MemberWire, Serialize<Member>>>().toEqualTypeOf<true>();
expectTypeOf<Equal<AuditLogEntryWire, Serialize<AuditLogEntry>>>().toEqualTypeOf<true>();

// ── OpenAPI ↔ Wire parity: EncryptedEntity envelope ─────────────────
//
// Every T1 response rides on this envelope. This is the first real
// OpenAPI→types tripwire in the pilot: if the OpenAPI spec or the
// mirror below drifts, this assertion fails.
//
// The mirror is kept local to this file rather than exported from
// `@pluralscape/types` because the envelope is an API-layer concern,
// not a domain concept.

interface EncryptedEntityWire {
  id: string;
  systemId: string;
  encryptedData: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}

expectTypeOf<
  Equal<components["schemas"]["EncryptedEntity"], EncryptedEntityWire>
>().toEqualTypeOf<true>();

// ── OpenAPI ↔ domain parity: PlaintextMember ────────────────────────
//
// `components["schemas"]["PlaintextMember"]` is the client-enforced
// pre-encryption contract. It must structurally equal the domain's
// encrypted-field projection. `MemberEncryptedFields` (keys union) +
// `Pick<Member, ...>` is the single source of truth; `Serialize<...>`
// strips brands and converts timestamps so the result matches JSON.

expectTypeOf<
  Equal<components["schemas"]["PlaintextMember"], Serialize<Pick<Member, MemberEncryptedFields>>>
>().toEqualTypeOf<true>();

// ── OpenAPI ↔ domain parity: MemberResponse plaintext columns ──────
//
// Every <X>Response has two parts: the opaque `encryptedData` field
// (string on wire, structured EncryptedBlob in domain — the asymmetry
// is at an encode/decode boundary that can't be structurally equated),
// and every other field (plaintext columns the server sees). The
// plaintext columns ARE assertable, so we split the parity:
//
// Piece 1: plaintext columns on both sides, minus `encryptedData`.
// Piece 2: `encryptedData` on the wire is opaque `string`.
//
// This catches per-entity plaintext column drift (e.g., `archived`
// rename, new denormalized column added to a response). Fleet must
// replicate this split for every renamed entity.

type MemberResponseOpenApi = components["schemas"]["MemberResponse"];

expectTypeOf<
  Equal<
    Omit<MemberResponseOpenApi, "encryptedData">,
    Omit<Serialize<MemberServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<MemberResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

// ── OpenAPI ↔ domain parity: FieldDefinitionResponse split parity ──

type FieldDefinitionResponseOpenApi = components["schemas"]["FieldDefinitionResponse"];

expectTypeOf<
  Equal<
    Omit<FieldDefinitionResponseOpenApi, "encryptedData">,
    Omit<Serialize<FieldDefinitionServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<FieldDefinitionResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

// ── OpenAPI ↔ domain parity: FieldValueResponse split parity ───────

type FieldValueResponseOpenApi = components["schemas"]["FieldValueResponse"];

expectTypeOf<
  Equal<
    Omit<FieldValueResponseOpenApi, "encryptedData">,
    Omit<Serialize<FieldValueServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<FieldValueResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

// ── OpenAPI ↔ domain parity: GroupResponse (split) ──────────────────

type GroupResponseOpenApi = components["schemas"]["GroupResponse"];

expectTypeOf<
  Equal<
    Omit<GroupResponseOpenApi, "encryptedData">,
    Omit<Serialize<GroupServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<GroupResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

// ── OpenAPI ↔ domain parity: CustomFrontResponse (split) ────────────

type CustomFrontResponseOpenApi = components["schemas"]["CustomFrontResponse"];

expectTypeOf<
  Equal<
    Omit<CustomFrontResponseOpenApi, "encryptedData">,
    Omit<Serialize<CustomFrontServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<CustomFrontResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

// ── OpenAPI ↔ domain parity: RelationshipResponse ──────────────────
//
// The full split-parity assertion is deferred: the OpenAPI wire spec
// currently marks `sourceMemberId`/`targetMemberId` non-nullable, while
// `Relationship` models them as `MemberId | null`. Reconciling that is a
// follow-up (either tighten the domain or widen the spec). The
// `PlaintextRelationship` equality below still enforces the
// label-field parity that Cluster 3 owns.

// ── OpenAPI ↔ domain parity: AuditLogEntry (plaintext wire) ─────────
//
// AuditLogEntry is plaintext on the wire (not encrypted), so the OpenAPI
// schema structurally matches the domain type directly.

expectTypeOf<
  Equal<components["schemas"]["AuditLogEntry"], Serialize<AuditLogEntry>>
>().toEqualTypeOf<true>();

// ── OpenAPI ↔ domain parity: PlaintextX (fleet, Phase 2) ────────────
//
// For each non-pilot entity, assert that the OpenAPI `PlaintextX` schema
// structurally equals `Serialize<Pick<<Entity>, <Entity>EncryptedFields>>`
// — the single source of truth for the client-encrypted payload contract.
// Sorted alphabetically by entity.

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextCustomFront"],
    Serialize<Pick<CustomFront, CustomFrontEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextFieldDefinition"],
    Serialize<Pick<FieldDefinition, FieldDefinitionEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextFieldValue"],
    Serialize<Pick<FieldValue, FieldValueEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["PlaintextGroup"], Serialize<Pick<Group, GroupEncryptedFields>>>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextMemberPhoto"],
    Serialize<Pick<MemberPhoto, MemberPhotoEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextRelationship"],
    Serialize<Pick<Relationship, RelationshipEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["PlaintextSystem"], Serialize<Pick<System, SystemEncryptedFields>>>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextStructureEntityType"],
    Serialize<Pick<SystemStructureEntityType, SystemStructureEntityTypeEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextStructureEntity"],
    Serialize<Pick<SystemStructureEntity, SystemStructureEntityEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextFrontingSession"],
    Serialize<Pick<FrontingSession, FrontingSessionEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextLifecycleEvent"],
    Serialize<Pick<LifecycleEvent, LifecycleEventEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextNomenclature"],
    Serialize<Pick<NomenclatureSettings, NomenclatureEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextInnerworldRegion"],
    Serialize<Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>>
  >
>().toEqualTypeOf<true>();

// `InnerWorldEntity` is a discriminated union whose variants carry
// different encrypted keys — a plain `Pick<Union, K>` would only accept
// keys present on *every* variant. `DistributivePick` distributes the
// pick over each member, intersecting the requested key-set with that
// member's own keys, so each variant contributes only the fields it
// actually owns.
type DistributivePick<T, K extends PropertyKey> = T extends unknown
  ? Pick<T, Extract<keyof T, K>>
  : never;

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextInnerworldEntity"],
    Serialize<DistributivePick<InnerWorldEntity, InnerWorldEntityEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextInnerworldCanvas"],
    Serialize<Pick<InnerWorldCanvas, InnerWorldCanvasEncryptedFields>>
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextSystemSettings"],
    Serialize<Pick<SystemSettings, SystemSettingsEncryptedFields>>
  >
>().toEqualTypeOf<true>();

// `SystemStructureEntityMemberLink` carries no encrypted fields today —
// its encrypted-fields union is `never`, so the projection is the empty
// object. openapi-typescript emits `Record<string, never>` for a schema
// with `properties: {}`, which is semantically "no fields" and matches
// `Pick<T, never>` once we collapse both to that canonical empty shape.
type EmptyEncryptedProjection<T, K extends keyof T> = [K] extends [never]
  ? Record<string, never>
  : Serialize<Pick<T, K>>;

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextStructureEntityMemberLink"],
    EmptyEncryptedProjection<
      SystemStructureEntityMemberLink,
      SystemStructureEntityMemberLinkEncryptedFields
    >
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["PlaintextStructureEntityAssociation"],
    EmptyEncryptedProjection<
      SystemStructureEntityAssociation,
      SystemStructureEntityAssociationEncryptedFields
    >
  >
>().toEqualTypeOf<true>();

// ── OpenAPI ↔ domain parity: InnerWorld*Response plaintext columns ──
//
// Split parity (same pattern as MemberResponse above): plaintext columns
// on both sides minus `encryptedData`, then asserting `encryptedData` on
// the wire is the opaque base64 `string`. Fleet-level tripwire for
// per-entity plaintext column drift on innerworld tables.

type RegionResponseOpenApi = components["schemas"]["RegionResponse"];

expectTypeOf<
  Equal<
    Omit<RegionResponseOpenApi, "encryptedData">,
    Omit<Serialize<InnerWorldRegionServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<RegionResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

type EntityResponseOpenApi = components["schemas"]["EntityResponse"];

expectTypeOf<
  Equal<
    Omit<EntityResponseOpenApi, "encryptedData">,
    Omit<Serialize<InnerWorldEntityServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<EntityResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();

type CanvasResponseOpenApi = components["schemas"]["CanvasResponse"];

expectTypeOf<
  Equal<
    Omit<CanvasResponseOpenApi, "encryptedData">,
    Omit<Serialize<InnerWorldCanvasServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<CanvasResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();
