# @pluralscape/validation

Shared Zod v4 schemas for all API request boundaries across the Pluralscape monorepo.

## Overview

`@pluralscape/validation` provides hand-written Zod schemas for every REST and tRPC request boundary in the API. Both the Hono REST routes (`apps/api/`) and tRPC procedure inputs import from this package, guaranteeing that the two transports enforce identical validation rules at runtime.

All schemas import from `zod/v4` — the Zod v4 subpath. The catalog version is pinned to `^4.3.6`.

TypeScript types in `@pluralscape/types` are the single source of truth — schema shapes are never inferred back into types. Schemas are hand-authored and locked to their domain counterparts via the parity gates documented in [ADR-023](../../docs/adr/023-zod-type-alignment.md) (amended 2026-04-29 to cover the full encrypted Class A/C/E + plaintext canonical chain). Per-entity `<Entity>EncryptedInputSchema`s mirror the `<Entity>EncryptedInput` keys-union from `packages/types`; request-body schemas mirror `Create<Entity>Body` / `Update<Entity>Body`; brand-aware fields use the `brandedString` / `brandedNumber` helpers and import the branded primitives (IDs and non-ID scalars) from `@pluralscape/types`.

Parity is enforced fleet-wide by `pnpm types:check-sot` — gates G2 (Drizzle ↔ Zod input), G3 (Domain ↔ Zod encrypted input), G7 (OpenAPI ↔ Wire), and G8/G9 (no hand-rolled body interfaces; no `params: unknown` + `safeParse` in services) all rely on this package. Per-entity parity tests live under `src/__tests__/type-parity/`.

Scope is intentionally limited to trust-boundary types and decrypt-boundary payloads:

- API request bodies, query parameters, import-job payloads, webhook inputs, and import-mapper output shapes.
- Encrypted-payload schemas wired at decrypt boundaries — every encrypted entity exports a `<Entity>EncryptedInputSchema` parsed against the JSON output of `decryptBlob`. These are consumed by `packages/data/src/transforms/` to validate decrypted blobs and by service-side encrypt paths to validate inputs before sealing.
- Plaintext entity body schemas are consolidated here following the ps-6phh canonical chain.

Internal domain types that never cross a trust boundary do not have schemas here. Adapter-local boundary schemas (e.g. BullMQ's `StoredJobDataSchema`) live in their own package; this one is the canonical home for schemas that cross the API surface or the decrypt boundary.

## Key Exports

### Auth and account

- `RegistrationInitiateSchema`, `RegistrationCommitSchema`, `LoginSchema`, `SaltFetchSchema`
- `ChangeEmailSchema`, `ChangePasswordSchema`
- `RegenerateRecoveryKeySchema`, `PasswordResetViaRecoveryKeySchema`
- `UpdateAccountSettingsSchema`, `DeleteAccountBodySchema`

### System and settings

- `UpdateSystemBodySchema`
- `SetupProfileStepBodySchema`, `SetupNomenclatureStepBodySchema`, `SetupCompleteBodySchema`
- `UpdateNomenclatureBodySchema`, `UpdateSystemSettingsBodySchema`, `SystemSettingsEncryptedInputSchema`, `NomenclatureSettingsEncryptedInputSchema`
- `SetPinBodySchema`, `VerifyPinBodySchema`, `RemovePinBodySchema`
- `BiometricEnrollBodySchema`, `BiometricVerifyBodySchema`
- `PurgeSystemBodySchema`, `CreateSnapshotBodySchema`, `DuplicateSystemBodySchema`, `SnapshotContentSchema`

### Members and groups

- `CreateMemberBodySchema`, `UpdateMemberBodySchema`, `DuplicateMemberBodySchema`, `MemberEncryptedInputSchema`, `MemberListQuerySchema`
- `CreateGroupBodySchema`, `UpdateGroupBodySchema`, `MoveGroupBodySchema`, `ReorderGroupsBodySchema`, `CopyGroupBodySchema`, `AddGroupMemberBodySchema`, `GroupEncryptedInputSchema`
- `CreateCustomFrontBodySchema`, `UpdateCustomFrontBodySchema`, `CustomFrontEncryptedInputSchema`
- `CreateMemberPhotoBodySchema`, `ReorderPhotosBodySchema`

### Fronting

- `CreateFrontingSessionBodySchema`, `UpdateFrontingSessionBodySchema`, `EndFrontingSessionBodySchema`, `FrontingSessionQuerySchema`, `FrontingSessionEncryptedInputSchema`
- `CreateFrontingCommentBodySchema`, `UpdateFrontingCommentBodySchema`, `FrontingCommentQuerySchema`, `FrontingCommentEncryptedInputSchema`
- `AnalyticsQuerySchema`, `CreateFrontingReportBodySchema`, `UpdateFrontingReportBodySchema`, `FrontingReportEncryptedInputSchema`

### Communication

- `CreateChannelBodySchema`, `UpdateChannelBodySchema`, `ChannelQuerySchema`, `ChannelEncryptedInputSchema`
- `CreateMessageBodySchema`, `UpdateMessageBodySchema`, `MessageQuerySchema`, `MessageTimestampQuerySchema`, `ChatMessageEncryptedInputSchema`
- `CreateBoardMessageBodySchema`, `UpdateBoardMessageBodySchema`, `ReorderBoardMessagesBodySchema`, `BoardMessageQuerySchema`, `BoardMessageEncryptedInputSchema`
- `CreateNoteBodySchema`, `UpdateNoteBodySchema`, `NoteQuerySchema`, `NoteEncryptedInputSchema`
- `CreatePollBodySchema`, `UpdatePollBodySchema`, `CastVoteBodySchema`, `UpdatePollVoteBodySchema`, `PollQuerySchema`, `PollVoteQuerySchema`, `PollEncryptedInputSchema`, `PollVoteEncryptedInputSchema`
- `CreateAcknowledgementBodySchema`, `ConfirmAcknowledgementBodySchema`, `AcknowledgementQuerySchema`, `AcknowledgementRequestEncryptedInputSchema`
- `CreateTimerConfigBodySchema`, `UpdateTimerConfigBodySchema`, `TimerConfigQuerySchema`, `TimerConfigEncryptedInputSchema`, `CreateCheckInRecordBodySchema`, `RespondCheckInRecordBodySchema`, `CheckInRecordQuerySchema`

### Privacy and friends

- `CreateBucketBodySchema`, `UpdateBucketBodySchema`, `BucketQuerySchema`, `TagContentBodySchema`, `UntagContentParamsSchema`, `BucketContentTagQuerySchema`, `SetFieldBucketVisibilityBodySchema`, `PrivacyBucketEncryptedInputSchema`
- `RedeemFriendCodeBodySchema`, `UpdateFriendVisibilityBodySchema`, `AssignBucketBodySchema`, `FriendConnectionQuerySchema`, `FriendCodeQuerySchema`
- `FriendExportQuerySchema`, `ListReceivedKeyGrantsQuerySchema`
- Friend dashboard blob shapes: `FriendDashboardMemberBlobSchema`, `FriendDashboardFrontingSessionBlobSchema`, `FriendDashboardCustomFrontBlobSchema`, `FriendDashboardStructureEntityBlobSchema` (plus matching `FriendDashboard*Blob` types)

### Structure and innerworld

- `CreateStructureEntityTypeBodySchema`, `UpdateStructureEntityTypeBodySchema`, `StructureEntityTypeEncryptedInputSchema`
- `CreateStructureEntityBodySchema`, `UpdateStructureEntityBodySchema`, `StructureEntityEncryptedInputSchema`
- `CreateStructureEntityLinkBodySchema`, `UpdateStructureEntityLinkBodySchema`
- `CreateStructureEntityMemberLinkBodySchema`, `CreateStructureEntityAssociationBodySchema`
- `StructureEntityLinkQuerySchema`, `StructureEntityMemberLinkQuerySchema`, `StructureEntityAssociationQuerySchema`
- `CreateRelationshipBodySchema`, `UpdateRelationshipBodySchema`, `RELATIONSHIP_TYPES`, `RelationshipEncryptedInputSchema`, `StandardRelationshipEncryptedSchema`, `CustomRelationshipEncryptedSchema`
- `CreateLifecycleEventBodySchema`, `UpdateLifecycleEventBodySchema`, `LIFECYCLE_EVENT_TYPES`, `LifecycleEventEncryptedInputSchema`, `LIFECYCLE_EVENT_ENCRYPTED_SCHEMAS`, `validateLifecycleMetadata`, `PlaintextMetadata` (type)
- `CreateRegionBodySchema`, `UpdateRegionBodySchema`, `CreateEntityBodySchema`, `UpdateEntityBodySchema`, `UpdateCanvasBodySchema`, `InnerWorldCanvasEncryptedInputSchema`, `InnerWorldEntityEncryptedInputSchema`, `InnerWorldRegionEncryptedInputSchema`

### Infrastructure

- `CreateApiKeyBodySchema`, `ApiKeyEncryptedPayloadSchema`
- `AuditLogQuerySchema`
- `DeviceInfoSchema` — session device-info shape
- `InitiateRotationBodySchema`, `ClaimChunkBodySchema`, `CompleteChunkBodySchema`
- `CreateWebhookConfigBodySchema`, `UpdateWebhookConfigBodySchema`, `RotateWebhookSecretBodySchema`, `WebhookConfigQuerySchema`, `WebhookDeliveryQuerySchema`
- `RegisterDeviceTokenBodySchema`, `UpdateDeviceTokenBodySchema`, `UpdateNotificationConfigBodySchema`, `UpdateFriendNotificationPreferenceBodySchema`
- `CreateUploadUrlBodySchema`, `ConfirmUploadBodySchema`, `ALLOWED_MIME_TYPES`
- `GenerateReportBodySchema`, `BucketExportQuerySchema`
- `CreateFieldDefinitionBodySchema`, `UpdateFieldDefinitionBodySchema`, `SetFieldValueBodySchema`, `UpdateFieldValueBodySchema`, `FieldDefinitionEncryptedInputSchema`, `FieldValueEncryptedInputSchema`

### Imports

Trust-boundary schemas shared between the API and the import packages (`@pluralscape/import-sp`, `@pluralscape/import-pk`). The importers derive their `Mapped*` output types via `z.infer<typeof CreateMemberBodySchema>` so mapper output cannot drift from the shape the API accepts.

- `CreateImportJobBodySchema`, `UpdateImportJobBodySchema`, `ImportJobQuerySchema`
- `ImportErrorSchema`, `ImportCheckpointStateSchema`
- `ImportEntityRefQuerySchema`, `ImportEntityRefLookupBatchBodySchema`, `ImportEntityRefUpsertBatchBodySchema`
- `ImportEntityRefLookupBatchBody`, `ImportEntityRefUpsertBatchBody` (types)

### Plaintext shared

- `HexColorSchema`, `PlaintextImageSourceSchema`, `PlaintextSaturationLevelSchema`, `PlaintextTagSchema` — shared plaintext primitives consumed by entity body schemas (ps-6phh).

### Utilities and constants

- `brandedString`, `brandedNumber` — generic Zod custom validators that produce `Brand<string, B>` / `Brand<number, B>` outputs without type assertions; mirror the brand fleet declared in `@pluralscape/types/src/ids.ts` and the non-ID brand modules. Used wherever a Zod field must yield a brand from `packages/types` (e.g. `Note.title`/`Note.content`, `Poll.title`/`PollOption.label`, `FieldDefinition.name`, `FrontingSession.comment`/`positionality`/`outtrigger`, lifecycle-event display brands).
- `brandedIdQueryParam` — prefix-strict parser for branded ID path/query parameters (e.g. `mem_<uuid>`); the canonical helper for ID brands.
- `booleanQueryParam`, `optionalBooleanQueryParam` — coerce string query params to booleans
- `IncludeArchivedQuerySchema`, `InnerWorldEntityQuerySchema`, `LifecycleEventQuerySchema`, `RelationshipQuerySchema`, `StructureEntityLinkQuerySchema`, `StructureEntityMemberLinkQuerySchema`, `StructureEntityAssociationQuerySchema` — shared query schemas
- `Base64ToUint8ArrayCodec` — bidirectional `z.codec` for the binary↔base64 boundary used inside JSON-encoded AEAD plaintexts
- `parseTimeToMinutes` — parse human-readable time strings to integer minutes
- Constants: `AUTH_MIN_PASSWORD_LENGTH`, `MAX_ENCRYPTED_DATA_SIZE`, `MAX_ENCRYPTED_SYSTEM_DATA_SIZE`, `MAX_ENCRYPTED_MEMBER_DATA_SIZE`, `MAX_ENCRYPTED_PHOTO_DATA_SIZE`, `MAX_ENCRYPTED_FIELD_DATA_SIZE`, `MAX_ENCRYPTED_FIELD_VALUE_SIZE`, `MAX_REORDER_OPERATIONS`, `MAX_ANALYTICS_CUSTOM_RANGE_MS`, `MAX_DEVICE_TOKEN_LENGTH`, `MAX_REPORT_TITLE_LENGTH`, `BUCKET_EXPORT_DEFAULT_LIMIT`, `BUCKET_EXPORT_MAX_LIMIT`, `IMPORT_ENTITY_REF_BATCH_MAX`, `WEBHOOK_EVENT_TYPE_VALUES`, `DEVICE_TOKEN_PLATFORM_VALUES`, `FRIEND_NOTIFICATION_EVENT_TYPE_VALUES`, `PUBLIC_KEY_BYTE_LENGTH` — see `validation.constants.ts`

## Usage

Import schemas directly from the package. Both REST handlers and tRPC procedure inputs use the same schema:

```typescript
import {
  CreateMemberBodySchema,
  CreateFrontingSessionBodySchema,
  LoginSchema,
} from "@pluralscape/validation";
import type { z } from "zod/v4";

// tRPC procedure input
export const createMember = protectedProcedure
  .input(CreateMemberBodySchema)
  .mutation(async ({ input, ctx }) => {
    // input is typed as z.infer<typeof CreateMemberBodySchema>
  });

// REST handler (Hono)
app.post("/members", async (c) => {
  const body = await c.req.json();
  const parsed = CreateMemberBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);
  // parsed.data is fully typed
});

// Infer request body type at a trust boundary
type LoginBody = z.infer<typeof LoginSchema>;
```

The importers re-use the same schemas as the API. For example, `@pluralscape/import-sp` defines `MappedMember` as `Omit<z.infer<typeof CreateMemberBodySchema>, "encryptedData"> & { ... }`, so mapper output is statically pinned to the shape the API already validates.

## Dependencies

| Package                          | Role                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `zod` (catalog, `^4.3.6`)        | Runtime schema parsing and type inference — imported via the `zod/v4` path |
| `@pluralscape/types` (workspace) | Canonical TypeScript types; schemas are verified to align with these       |

## Testing

Unit tests live in `packages/validation/src/__tests__/`. Per-entity parity tests under `src/__tests__/type-parity/` use `Equal<>` and `expectTypeOf` to lock `z.infer<typeof Schema>` to its `@pluralscape/types` counterpart at compile time, alongside `safeParse` round-trips for runtime shape. These are the gates G2 / G3 surfaces of `pnpm types:check-sot` (G7 OpenAPI ↔ Wire and G10 wire derivation extend the same parity story to the generated `api-types.ts`).

```bash
# Unit tests
pnpm vitest run --project validation

# Full Types-as-SoT parity gate (typecheck + Drizzle + Zod + OpenAPI-Wire)
pnpm types:check-sot
```

There is no integration variant — this package has no I/O boundaries.
