/**
 * Compile-time-only OpenAPI-Wire parity check for the types-ltel pilot.
 *
 * Asserts that OpenAPI-generated response types from `@pluralscape/api-client`
 * structurally equal their corresponding `<Entity>Wire` types from
 * `@pluralscape/types`.
 *
 * Typechecked via `pnpm types:check-sot`.
 *
 * ── Scope and deferrals ──────────────────────────────────────────────
 *
 * `MemberResponse` parity is intentionally not asserted here. OpenAPI
 * models `encryptedData` as an opaque `string` (the base64-encoded
 * envelope on the wire), while `MemberServerMetadata.encryptedData` is
 * the structured `EncryptedBlob` discriminated union (pre-serialization).
 * A direct `Equal<components["schemas"]["MemberResponse"],
 * Serialize<MemberServerMetadata>>` assertion would fail by design. The
 * shared `EncryptedEntity` envelope parity below is the real tripwire
 * for the wire shape every encrypted response rides on.
 *
 * `AuditLogEntry` is plaintext on the wire (not encrypted), so the
 * OpenAPI schema structurally matches the domain type directly and a
 * real `Equal<components["schemas"]["AuditLogEntry"],
 * Serialize<AuditLogEntry>>` compile-time check is enforced below.
 *
 * What this file enforces right now:
 *  - `MemberWire ≡ Serialize<Member>` (self-consistency of the helper).
 *  - `AuditLogEntryWire ≡ Serialize<AuditLogEntry>` (same).
 *  - `components["schemas"]["EncryptedEntity"]` is structurally equal to the
 *    hand-authored `EncryptedEntityWire` mirror below — a real OpenAPI→
 *    domain parity tripwire for the shared envelope that every T1 response
 *    (including Member) rides on.
 *  - `components["schemas"]["PlaintextMember"]` structurally equals
 *    `Serialize<Pick<Member, MemberEncryptedFields>>` — the pre-encryption
 *    contract derived directly from the domain.
 *  - `components["schemas"]["AuditLogEntry"]` structurally equals
 *    `Serialize<AuditLogEntry>` — plaintext-wire parity for the audit log.
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
  Equal,
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldValue,
  FieldValueEncryptedFields,
  FrontingSession,
  FrontingSessionEncryptedFields,
  Group,
  GroupEncryptedFields,
  LifecycleEvent,
  LifecycleEventEncryptedFields,
  Member,
  MemberEncryptedFields,
  MemberPhoto,
  MemberPhotoEncryptedFields,
  MemberWire,
  Relationship,
  RelationshipEncryptedFields,
  Serialize,
  System,
  SystemEncryptedFields,
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields,
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
  archivedAt?: number | null;
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
