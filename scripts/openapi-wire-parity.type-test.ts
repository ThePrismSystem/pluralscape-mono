/**
 * Compile-time-only OpenAPI-Wire parity check.
 *
 * Asserts that every OpenAPI-generated `<X>Response` type from
 * `@pluralscape/api-client` structurally equals its corresponding
 * `<Entity>Wire` type from `@pluralscape/types`.
 *
 * Typechecked via `pnpm types:check-sot`.
 *
 * ── G7 form ─────────────────────────────────────────────────────────
 *
 * `<Entity>Wire` is `Serialize<<Entity>Result>`, where `<Entity>Result =
 * EncryptedWire<<Entity>ServerMetadata>` collapses the structured
 * `EncryptedBlob` to the wire-form base64 string and strips brand markers.
 * The OpenAPI generator emits `encryptedData: string` for every encrypted
 * entity, so a single `Equal<XResponse, XWire>` assertion catches drift on
 * BOTH the encrypted-data field AND every plaintext column the server
 * exposes — there is no longer a split-parity carve-out per entity.
 *
 * `AuditLogEntry` is plaintext on the wire (not encrypted), so its OpenAPI
 * schema structurally matches `Serialize<AuditLogEntry>` directly.
 *
 * The shared `EncryptedEntity` envelope parity serves as the canonical
 * tripwire for the envelope shape itself (the set of plaintext columns
 * every T1 response rides on). If the envelope drifts, every per-entity
 * G7 assertion will also trip — the envelope check localizes the diagnosis.
 *
 * `Plaintext<X>` parity asserts the pre-encryption contract (what callers
 * submit before encryption) equals `Serialize<Pick<<Entity>,
 * <Entity>EncryptedFields>>` — distinct from response parity above.
 *
 * Adding a bogus field on either side of any assertion will fail the gate
 * — see `pnpm types:check-sot`.
 */

import type { components } from "../packages/api-client/src/generated/api-types.js";
import type {
  AcknowledgementRequestWire,
  ApiKeyWire,
  AuditLogEntry,
  AuditLogEntryWire,
  BoardMessageWire,
  ChannelWire,
  ChatMessageWire,
  CheckInRecordWire,
  CustomFront,
  CustomFrontEncryptedFields,
  CustomFrontWire,
  EncryptedBase64,
  EncryptedBlob,
  EncryptedWire,
  Equal,
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldDefinitionWire,
  FieldValue,
  FieldValueEncryptedFields,
  FieldValueWire,
  FrontingCommentWire,
  FrontingSession,
  FrontingSessionEncryptedFields,
  Group,
  GroupEncryptedFields,
  GroupWire,
  ImportEntityRefWire,
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedFields,
  InnerWorldCanvasWire,
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields,
  InnerWorldEntityWire,
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields,
  InnerWorldRegionWire,
  LifecycleEvent,
  LifecycleEventEncryptedFields,
  Member,
  MemberEncryptedFields,
  MemberPhoto,
  MemberPhotoEncryptedFields,
  MemberResult,
  MemberServerMetadata,
  MemberWire,
  NomenclatureEncryptedFields,
  NomenclatureSettings,
  NoteWire,
  PollVoteWire,
  PollWire,
  Relationship,
  RelationshipEncryptedFields,
  Serialize,
  System,
  SystemEncryptedFields,
  SystemServerMetadata,
  SystemSettings,
  SystemSettingsEncryptedFields,
  SystemStructureEntity,
  SystemStructureEntityAssociation,
  SystemStructureEntityAssociationEncryptedFields,
  SystemStructureEntityAssociationWire,
  SystemStructureEntityEncryptedFields,
  SystemStructureEntityLinkWire,
  SystemStructureEntityMemberLink,
  SystemStructureEntityMemberLinkEncryptedFields,
  SystemStructureEntityMemberLinkWire,
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
  SystemStructureEntityTypeWire,
  SystemStructureEntityWire,
  TimerConfigWire,
} from "../packages/types/src/index.js";
import { expectTypeOf } from "vitest";

// ── Wire helpers self-consistency ────────────────────────────────────
//
// `<Entity>Wire` must equal `Serialize<<Entity>Result>` — no hand-authored
// drift from the helper-derived form.

expectTypeOf<Equal<MemberWire, Serialize<MemberResult>>>().toEqualTypeOf<true>();
expectTypeOf<Equal<AuditLogEntryWire, Serialize<AuditLogEntry>>>().toEqualTypeOf<true>();

// ── OpenAPI ↔ Wire parity: EncryptedEntity envelope ─────────────────
//
// Every T1 response rides on this envelope. If the OpenAPI spec or the
// mirror below drifts, this assertion fails and localizes the diagnosis
// before the per-entity tripwires fire.
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

// ── OpenAPI ↔ Wire parity: <X>Response ≡ <Entity>Wire (G7) ─────────
//
// Single full-equality assertion per entity. `<Entity>Wire =
// Serialize<EncryptedWire<<Entity>ServerMetadata>>` collapses the
// structured `EncryptedBlob` to a plain base64 string and strips brand
// markers, so this single check enforces both `encryptedData` shape AND
// every plaintext column at once.

expectTypeOf<Equal<components["schemas"]["MemberResponse"], MemberWire>>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["FieldDefinitionResponse"], FieldDefinitionWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["FieldValueResponse"], FieldValueWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["FrontingCommentResponse"], FrontingCommentWire>
>().toEqualTypeOf<true>();

expectTypeOf<Equal<components["schemas"]["GroupResponse"], GroupWire>>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["CustomFrontResponse"], CustomFrontWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["StructureEntityTypeResponse"], SystemStructureEntityTypeWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["StructureEntityResponse"], SystemStructureEntityWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["RegionResponse"], InnerWorldRegionWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["EntityResponse"], InnerWorldEntityWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["CanvasResponse"], InnerWorldCanvasWire>
>().toEqualTypeOf<true>();

// CheckInRecord is a hybrid (no `EncryptedFields`/`EncryptedInput`): the
// domain is plaintext but the server row carries an optional encrypted
// blob. `EncryptedWire<…>` strips the `ServerInternal<…>` `idempotencyKey`,
// so this single check enforces both the plaintext envelope and the
// nullable `encryptedData` shape on the wire.
expectTypeOf<
  Equal<components["schemas"]["CheckInRecordResponse"], CheckInRecordWire>
>().toEqualTypeOf<true>();

expectTypeOf<Equal<components["schemas"]["ChannelResponse"], ChannelWire>>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["MessageResponse"], ChatMessageWire>
>().toEqualTypeOf<true>();

expectTypeOf<Equal<components["schemas"]["NoteResponse"], NoteWire>>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["BoardMessageResponse"], BoardMessageWire>
>().toEqualTypeOf<true>();

expectTypeOf<Equal<components["schemas"]["PollResponse"], PollWire>>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<components["schemas"]["PollVoteResponse"], PollVoteWire>
>().toEqualTypeOf<true>();

// TimerConfig: server adds plaintext `nextCheckInAt` to the row for
// scheduling without requiring blob decryption (see TimerConfigServerMetadata).
expectTypeOf<
  Equal<components["schemas"]["TimerConfigResponse"], TimerConfigWire>
>().toEqualTypeOf<true>();

// Acknowledgement: OpenAPI schema name (`AcknowledgementResponse`) diverges
// from the canonical type name (`AcknowledgementRequestWire`) — the domain
// type is `AcknowledgementRequest`, the API surface trims the suffix.
expectTypeOf<
  Equal<components["schemas"]["AcknowledgementResponse"], AcknowledgementRequestWire>
>().toEqualTypeOf<true>();

// ApiKey: Class C entity. `ApiKeyWire = Serialize<ApiKeyServerVisible>` —
// the wire surface is a positive `Pick` allowlist of the server-visible
// columns (no `tokenHash`, no `encryptedData`, no `encryptedKeyMaterial`,
// no `accountId`). Any drift between the OpenAPI spec and the allowlist
// fails this gate.
expectTypeOf<Equal<components["schemas"]["ApiKeyResponse"], ApiKeyWire>>().toEqualTypeOf<true>();

// JournalEntryResponse and WikiPageResponse: canonical wire types exist
// (`JournalEntryWire`, `WikiPageWire`) but no OpenAPI route schema is
// authored yet. G7 deferred until the routes are added — see types-iupb.

// ── G7 fleet expansion: plaintext-link entities ─────────────────────
//
// Structure-entity links / member-links / associations are plaintext
// junction tables. Their wire types are Serialize-derived directly from
// the domain shape (no encryption envelope), so the OpenAPI Response
// schemas equal the wire types once the YAML correctly marks all
// columns required.

expectTypeOf<
  Equal<components["schemas"]["StructureEntityLinkResponse"], SystemStructureEntityLinkWire>
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["StructureEntityMemberLinkResponse"],
    SystemStructureEntityMemberLinkWire
  >
>().toEqualTypeOf<true>();

expectTypeOf<
  Equal<
    components["schemas"]["StructureEntityAssociationResponse"],
    SystemStructureEntityAssociationWire
  >
>().toEqualTypeOf<true>();

// `ImportEntityRef` is a discriminated union over `sourceEntityType`.
// Both the OpenAPI Response schema and the canonical wire shape carry
// the same union of branded → string mappings, so the equality holds
// once openapi-typescript flattens the discriminator.
expectTypeOf<
  Equal<components["schemas"]["ImportEntityRefResponse"], ImportEntityRefWire>
>().toEqualTypeOf<true>();

// ── G7 fleet expansion: deferred entries ─────────────────────────────
//
// The remaining plaintext entities have OpenAPI Response schemas that
// are intentionally curated subsets of the canonical wire (e.g. omit
// `accountId`, `version`, `updatedAt`) or include columns the wire
// strips via `ServerInternal<…>`. Bringing each pair into G7 parity
// requires one of:
//
//   • widening the OpenAPI schema to expose every wire column (e.g.
//     `WebhookConfigResponse` flips most fields from optional to
//     required + adds `secret` / audit columns), or
//   • narrowing the wire shape with explicit allowlists / `ServerInternal<>`
//     rebrands so the canonical wire matches the curated emission.
//
// Both paths are non-trivial cross-package refactors and out of scope
// for the parity-gate expansion task. Tracked as follow-ups:
//
//   • DeviceTokenResponse                  ↔ DeviceTokenWire
//   • FriendCodeResponse                   ↔ FriendCodeWire
//   • FriendNotificationPreferenceResponse ↔ FriendNotificationPreferenceWire
//   • FrontingReportResponse               ↔ FrontingReportWire
//   • ImportJobResponse                    ↔ ImportJobWire
//     (checkpointState narrows the entity-type union — needs
//     `ImportCheckpointStateOpenApi` matching the TS `ImportCollectionType`)
//   • NotificationConfigResponse           ↔ NotificationConfigWire
//   • WebhookConfigResponse                ↔ WebhookConfigWire
//   • WebhookDeliveryResponse              ↔ WebhookDeliveryWire
//
// Internal-only entities — no OpenAPI route schema exists, by design:
//
//   • Account / AccountWire — `AccountInfo` is a curated read-only
//     shape; account columns aren't surfaced as a single wire envelope.
//   • AccountPurgeRequest, AuthKey, BlobMetadata,
//     BucketKeyRotation, BucketRotationItem, DeviceTransferRequest,
//     ExportRequest, FieldDefinitionScope, KeyGrant, RecoveryKey,
//     Session, SyncDocument, SystemSnapshot — currently exposed only
//     via aggregate / collection wrappers (e.g. `SnapshotResponse`,
//     `RecoveryKeyStatusResponse`) or admin / internal endpoints.
//
// Adding any of those routes triggers the G7 gate above — define the
// `<X>Response` schema in the corresponding OpenAPI YAML and the
// regenerated typecheck will require a paired Equal assertion.

// ── OpenAPI ↔ domain parity: RelationshipResponse ──────────────────
//
// G7 full equality is deferred: the OpenAPI wire spec currently marks
// `sourceMemberId`/`targetMemberId` non-nullable, while `Relationship`
// models them as `MemberId | null`. Reconciling that is a follow-up
// (either tighten the domain or widen the spec). The
// `PlaintextRelationship` equality below still enforces the
// label-field parity that Cluster 3 owns.

// ── OpenAPI ↔ domain parity: AuditLogEntry (plaintext wire) ─────────

expectTypeOf<
  Equal<components["schemas"]["AuditLogEntry"], Serialize<AuditLogEntry>>
>().toEqualTypeOf<true>();

// ── OpenAPI ↔ domain parity: PlaintextX (fleet) ─────────────────────
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
    // Distributive Pick — `{ label: string }` for custom, `{}` for standard.
    // Matches `RelationshipEncryptedInput` (see packages/types/src/entities/relationship.ts).
    Serialize<
      Relationship extends unknown
        ? Pick<Relationship, Extract<keyof Relationship, RelationshipEncryptedFields>>
        : never
    >
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

// `LifecycleEvent` is a discriminated union whose variants carry
// different encrypted keys — a plain `Pick<Union, K>` would only accept
// keys present on *every* variant. `DistributivePick` distributes the
// pick over each member, intersecting with that member's own keys so
// each variant contributes only the fields it actually owns.
expectTypeOf<
  Equal<
    components["schemas"]["PlaintextLifecycleEvent"],
    Serialize<DistributivePick<LifecycleEvent, LifecycleEventEncryptedFields>>
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

// ── EncryptedWire<T> nullability bridging ──────────────────────────
//
// The whole reason `EncryptedWire<T>` is generic is the conditional
// `null extends T["encryptedData"] ? string | null : string`. These
// assertions pin both arms: a synthetic non-nullable / nullable pair,
// plus one real-entity bridge per arm (Member is non-nullable;
// System stores a nullable blob because bootstrap rows may precede
// the first encrypted payload).

expectTypeOf<
  EncryptedWire<{ readonly encryptedData: EncryptedBlob }>["encryptedData"]
>().toEqualTypeOf<EncryptedBase64>();

expectTypeOf<
  EncryptedWire<{ readonly encryptedData: EncryptedBlob | null }>["encryptedData"]
>().toEqualTypeOf<EncryptedBase64 | null>();

expectTypeOf<
  EncryptedWire<MemberServerMetadata>["encryptedData"]
>().toEqualTypeOf<EncryptedBase64>();

expectTypeOf<
  EncryptedWire<SystemServerMetadata>["encryptedData"]
>().toEqualTypeOf<EncryptedBase64 | null>();

// Brand-to-OpenAPI bridge: `EncryptedBase64` is a subtype of `string`, so
// the OpenAPI-side `encryptedData: string` assertions remain valid even as
// `EncryptedWire<T>` brands the field. This explicit subtype assertion
// documents the bridge for future readers.
expectTypeOf<EncryptedBase64 extends string ? true : false>().toEqualTypeOf<true>();
