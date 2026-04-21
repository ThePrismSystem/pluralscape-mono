# @pluralscape/validation

Shared Zod v4 schemas for all API request boundaries across the Pluralscape monorepo.

## Overview

`@pluralscape/validation` provides hand-written Zod schemas for every REST and tRPC request boundary in the API. Both the Hono REST routes (`apps/api/`) and tRPC procedure inputs import from this package, guaranteeing that the two transports enforce identical validation rules at runtime.

All schemas import from `zod/v4` — the Zod v4 subpath. The catalog version is pinned to `^4.3.6`.

TypeScript types remain the source of truth — defined in `@pluralscape/types`, never inferred from schemas. The `packages/validation` schemas are written by hand and verified against those types via contract tests that run `expectTypeOf` (compile-time alignment) and `safeParse` (runtime shape). This approach is documented in [ADR 023](../../docs/adr/023-zod-type-alignment.md).

Scope is intentionally limited to trust-boundary types: API request bodies, query parameters, import job payloads, webhook inputs, and import-mapper output shapes. Internal domain types that never cross a trust boundary do not have schemas here. Adapter-local boundary schemas (e.g. BullMQ's `StoredJobDataSchema`) live in their own package; this one is the canonical home for schemas that cross the API surface.

## Key Exports

### Auth and account

- `RegistrationInitiateSchema`, `RegistrationCommitSchema`, `LoginSchema`, `SaltFetchSchema`
- `ChangeEmailSchema`, `ChangePasswordSchema`
- `RegenerateRecoveryKeySchema`, `PasswordResetViaRecoveryKeySchema`
- `UpdateAccountSettingsSchema`, `DeleteAccountBodySchema`

### System and settings

- `UpdateSystemBodySchema`
- `SetupProfileStepBodySchema`, `SetupNomenclatureStepBodySchema`, `SetupCompleteBodySchema`
- `UpdateNomenclatureBodySchema`, `UpdateSystemSettingsBodySchema`
- `SetPinBodySchema`, `VerifyPinBodySchema`, `RemovePinBodySchema`
- `BiometricEnrollBodySchema`, `BiometricVerifyBodySchema`
- `PurgeSystemBodySchema`, `CreateSnapshotBodySchema`, `DuplicateSystemBodySchema`

### Members and groups

- `CreateMemberBodySchema`, `UpdateMemberBodySchema`, `DuplicateMemberBodySchema`, `MemberListQuerySchema`
- `CreateGroupBodySchema`, `UpdateGroupBodySchema`, `MoveGroupBodySchema`, `ReorderGroupsBodySchema`, `CopyGroupBodySchema`, `AddGroupMemberBodySchema`
- `CreateCustomFrontBodySchema`, `UpdateCustomFrontBodySchema`
- `CreateMemberPhotoBodySchema`, `ReorderPhotosBodySchema`

### Fronting

- `CreateFrontingSessionBodySchema`, `UpdateFrontingSessionBodySchema`, `EndFrontingSessionBodySchema`, `FrontingSessionQuerySchema`
- `CreateFrontingCommentBodySchema`, `UpdateFrontingCommentBodySchema`, `FrontingCommentQuerySchema`
- `AnalyticsQuerySchema`, `CreateFrontingReportBodySchema`, `UpdateFrontingReportBodySchema`

### Communication

- `CreateChannelBodySchema`, `UpdateChannelBodySchema`, `ChannelQuerySchema`
- `CreateMessageBodySchema`, `UpdateMessageBodySchema`, `MessageQuerySchema`, `MessageTimestampQuerySchema`
- `CreateBoardMessageBodySchema`, `UpdateBoardMessageBodySchema`, `ReorderBoardMessagesBodySchema`, `BoardMessageQuerySchema`
- `CreateNoteBodySchema`, `UpdateNoteBodySchema`, `NoteQuerySchema`
- `CreatePollBodySchema`, `UpdatePollBodySchema`, `CastVoteBodySchema`, `UpdatePollVoteBodySchema`, `PollQuerySchema`, `PollVoteQuerySchema`
- `CreateAcknowledgementBodySchema`, `ConfirmAcknowledgementBodySchema`, `AcknowledgementQuerySchema`
- `CreateTimerConfigBodySchema`, `UpdateTimerConfigBodySchema`, `TimerConfigQuerySchema`, `CreateCheckInRecordBodySchema`, `RespondCheckInRecordBodySchema`, `CheckInRecordQuerySchema`

### Privacy and friends

- `CreateBucketBodySchema`, `UpdateBucketBodySchema`, `BucketQuerySchema`, `TagContentBodySchema`, `BucketContentTagQuerySchema`, `SetFieldBucketVisibilityBodySchema`
- `RedeemFriendCodeBodySchema`, `UpdateFriendVisibilityBodySchema`, `AssignBucketBodySchema`, `FriendConnectionQuerySchema`, `FriendCodeQuerySchema`
- `FriendExportQuerySchema`, `ListReceivedKeyGrantsQuerySchema`

### Structure and innerworld

- `CreateStructureEntityTypeBodySchema`, `UpdateStructureEntityTypeBodySchema`
- `CreateStructureEntityBodySchema`, `UpdateStructureEntityBodySchema`
- `CreateStructureEntityLinkBodySchema`, `UpdateStructureEntityLinkBodySchema`
- `CreateStructureEntityMemberLinkBodySchema`, `CreateStructureEntityAssociationBodySchema`
- `StructureEntityLinkQuerySchema`, `StructureEntityMemberLinkQuerySchema`, `StructureEntityAssociationQuerySchema`
- `CreateRelationshipBodySchema`, `UpdateRelationshipBodySchema`, `RELATIONSHIP_TYPES`
- `CreateLifecycleEventBodySchema`, `UpdateLifecycleEventBodySchema`, `LIFECYCLE_EVENT_TYPES`, `validateLifecycleMetadata`, `PlaintextMetadata` (type)
- `CreateRegionBodySchema`, `UpdateRegionBodySchema`, `CreateEntityBodySchema`, `UpdateEntityBodySchema`, `UpdateCanvasBodySchema`

### Infrastructure

- `CreateApiKeyBodySchema`
- `AuditLogQuerySchema`
- `InitiateRotationBodySchema`, `ClaimChunkBodySchema`, `CompleteChunkBodySchema`
- `CreateWebhookConfigBodySchema`, `UpdateWebhookConfigBodySchema`, `RotateWebhookSecretBodySchema`, `WebhookConfigQuerySchema`, `WebhookDeliveryQuerySchema`
- `RegisterDeviceTokenBodySchema`, `UpdateDeviceTokenBodySchema`, `UpdateNotificationConfigBodySchema`, `UpdateFriendNotificationPreferenceBodySchema`
- `CreateUploadUrlBodySchema`, `ConfirmUploadBodySchema`, `ALLOWED_MIME_TYPES`
- `GenerateReportBodySchema`, `BucketExportQuerySchema`
- `CreateFieldDefinitionBodySchema`, `UpdateFieldDefinitionBodySchema`, `SetFieldValueBodySchema`, `UpdateFieldValueBodySchema`

### Imports

Trust-boundary schemas shared between the API and the import packages (`@pluralscape/import-sp`, `@pluralscape/import-pk`). The importers derive their `Mapped*` output types via `z.infer<typeof CreateMemberBodySchema>` so mapper output cannot drift from the shape the API accepts.

- `CreateImportJobBodySchema`, `UpdateImportJobBodySchema`, `ImportJobQuerySchema`
- `ImportErrorSchema`, `ImportCheckpointStateSchema`
- `ImportEntityRefQuerySchema`, `ImportEntityRefLookupBatchBodySchema`, `ImportEntityRefUpsertBatchBodySchema`
- `ImportEntityRefLookupBatchBody`, `ImportEntityRefUpsertBatchBody` (types)

### Utilities and constants

- `brandedString`, `brandedNumber` — helpers for branded-type schemas, centralising the one warranted `z.custom` call
- `brandedIdQueryParam` — parse and validate branded ID path/query parameters
- `booleanQueryParam`, `optionalBooleanQueryParam` — coerce string query params to booleans
- `IncludeArchivedQuerySchema`, `InnerWorldEntityQuerySchema`, `LifecycleEventQuerySchema`, `RelationshipQuerySchema` and related query schemas
- `parseTimeToMinutes` — parse human-readable time strings to integer minutes
- Constants: `AUTH_MIN_PASSWORD_LENGTH`, `MAX_ENCRYPTED_DATA_SIZE`, `MAX_ENCRYPTED_SYSTEM_DATA_SIZE`, `MAX_ENCRYPTED_MEMBER_DATA_SIZE`, `MAX_ENCRYPTED_PHOTO_DATA_SIZE`, `MAX_ENCRYPTED_FIELD_DATA_SIZE`, `MAX_ENCRYPTED_FIELD_VALUE_SIZE`, `MAX_REORDER_OPERATIONS`, `MAX_ANALYTICS_CUSTOM_RANGE_MS`, `MAX_DEVICE_TOKEN_LENGTH`, `MAX_REPORT_TITLE_LENGTH`, `BUCKET_EXPORT_DEFAULT_LIMIT`, `BUCKET_EXPORT_MAX_LIMIT`, `IMPORT_ENTITY_REF_BATCH_MAX`, `WEBHOOK_EVENT_TYPE_VALUES`, `DEVICE_TOKEN_PLATFORM_VALUES`, `FRIEND_NOTIFICATION_EVENT_TYPE_VALUES` — see `validation.constants.ts`

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

Unit tests live in `packages/validation/src/__tests__/`. They use contract tests to verify schema-to-type alignment at both compile time (`expectTypeOf`) and runtime (`safeParse`).

```bash
# Unit tests
pnpm vitest run --project validation
```

There is no integration variant — this package has no I/O boundaries.
