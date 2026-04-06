# @pluralscape/types

Shared TypeScript domain types and runtime primitives for the Pluralscape monorepo.

## Overview

This package is the single source of truth for every domain type across the Pluralscape system.
It deliberately contains no business logic and no runtime dependencies beyond the TypeScript
standard library, keeping the dependency graph clean: every other `@pluralscape/*` package
imports from here, never the reverse.

The package solves a concrete problem: Pluralscape is E2E encrypted, and the same conceptual
entity (a member, a fronting session, a journal entry) exists in two forms — a `Server*` variant
holding ciphertext that the API persists and returns, and a `Client*` variant holding plaintext
after the mobile app has decrypted it. Without shared types enforced at compile time, it is easy
to accidentally log, cache, or transmit data in the wrong form. The `encryption.ts` module
defines both variants for every encrypted entity, and the `ServerSafe<T>` branded wrapper
(`server-safe.ts`) provides a zero-runtime-overhead type fence that prevents unverified data
from reaching API responses.

A second key design decision is nominal typing via `Brand<T, B>`. Every entity ID is a distinct
branded string type (`SystemId`, `MemberId`, `FrontingSessionId`, etc.), preventing cross-entity
ID mix-ups that structural typing would silently permit. The `ID_PREFIXES` constant maps each
entity type to its runtime prefix, which `createId()` in `runtime.ts` enforces at creation time.
See [ADR-006](../../docs/adr/006-encryption.md) for the encryption boundary rationale and
[ADR-013](../../docs/adr/013-api-auth-encryption.md) for the server/client data boundary.

## Key Exports

### IDs and Branding (`ids.ts`)

- `Brand<T, B>` — phantom-type utility for nominal typing
- `SystemId`, `MemberId`, `GroupId`, `FrontingSessionId`, `CustomFrontId` — core identity IDs
- `BucketId`, `KeyGrantId` — privacy bucket IDs
- `SessionId`, `AccountId`, `AuthKeyId`, `RecoveryKeyId`, `DeviceTransferRequestId` — auth IDs
- `SyncDocumentId`, `SyncChangeId`, `SyncSnapshotId` — sync document IDs
- `BlobId`, `JobId`, `WebhookId`, `TimerId`, and 40+ additional branded ID types
- `HexColor`, `SlugHash`, `ChecksumHex`, `StorageKey` — branded scalar types
- `ID_PREFIXES` — runtime map of entity type to string prefix (e.g. `"sys_"`, `"mbr_"`)
- `EntityType` — discriminated union of all entity type strings

### Domain Types by Feature

| Module                 | Types                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity.ts`          | `System`, `Member`, `MemberPhoto`, `Tag`, `SaturationLevel`, `CreateMemberBody`, `UpdateMemberBody`                                        |
| `fronting.ts`          | `ActiveFrontingSession`, `CompletedFrontingSession`, `FrontingSession`, `CustomFront`, `CoFrontState`, `OuttriggerSentiment`               |
| `privacy.ts`           | `PrivacyBucket`, `BucketVisibilityScope`, `KeyGrant`, `FriendConnection`, `FriendCode`, `BucketAccessCheck`                                |
| `structure.ts`         | `SystemStructureEntity`, `SystemStructureEntityType`, `Relationship`, `SystemProfile`, `ArchitectureType`                                  |
| `groups.ts`            | `Group`, `GroupMembership`, `GroupTree`, `GroupMoveOperation`                                                                              |
| `encryption.ts`        | `Server*` / `Client*` pairs for every encrypted entity, `Encrypted`, `BucketEncrypted`, `ServerSafe`, `DecryptFn`, `EncryptFn`             |
| `auth.ts`              | `Account`, `AuthKey`, `Session`, `RecoveryKey`, `DeviceTransferRequest`, `LoginCredentials`                                                |
| `communication.ts`     | `Channel`, `ChatMessage`, `BoardMessage`, `Note`, `Poll`, `PollVote`, `AcknowledgementRequest`                                             |
| `journal.ts`           | `JournalEntry`, `WikiPage`, `JournalBlock` (paragraph, heading, list, quote, code, image, divider, member/entity link), `FrontingSnapshot` |
| `lifecycle.ts`         | `LifecycleEvent`, `SplitEvent`, `FusionEvent`, `DiscoveryEvent`, `ArchivalEvent`, and 8 additional event types                             |
| `custom-fields.ts`     | `FieldDefinition`, `FieldValue`, `FieldType`, `FieldBucketVisibility`                                                                      |
| `analytics.ts`         | `FrontingAnalytics`, `CoFrontingAnalytics`, `ChartData`, `DateRangeFilter`, `DateRangePreset`                                              |
| `innerworld.ts`        | `InnerWorldCanvas`, `InnerWorldEntity`, `InnerWorldRegion`                                                                                 |
| `sync.ts`              | `SyncDocument`, `SyncState`, `SyncIndicator`, `SyncDocumentType`                                                                           |
| `import-export.ts`     | `ImportJob`, `ExportRequest`, `SPImport*`, `PKImport*`, `AccountPurgeRequest`                                                              |
| `pk-bridge.ts`         | `PKBridgeConfig`, `PKEntityMapping`, `PKSyncState`, `PKSyncError`                                                                          |
| `webhooks.ts`          | `WebhookConfig`, `WebhookDelivery`, `WebhookEventPayloadMap`                                                                               |
| `notifications.ts`     | `DeviceToken`, `NotificationConfig`, `FriendNotificationPreference`                                                                        |
| `realtime.ts`          | `WebSocketEvent`, `SSEEvent`, `RealtimeSubscription`, `WebSocketConnectionState`                                                           |
| `settings.ts`          | `SystemSettings`, `AppLockConfig`, `SyncPreferences`, `PrivacyDefaults`                                                                    |
| `nomenclature.ts`      | `NomenclatureSettings`, `TermCategory`, `TermPreset`                                                                                       |
| `littles-safe-mode.ts` | `LittlesSafeModeConfig`, `SafeModeUIFlags`, `SafeModeContentItem`                                                                          |
| `snapshot.ts`          | `SystemSnapshot` and per-entity snapshot subtypes                                                                                          |
| `key-rotation.ts`      | `BucketKeyRotation`, `BucketRotationItem`, `RotationState`                                                                                 |
| `audit-log.ts`         | `AuditLogEntry`, `AuditEventType`, `AuditActor`                                                                                            |

### Shared Utilities

- `results.ts` — `Result<T>`, `ApiError`, `ApiErrorResponse`, `ValidationError`
- `pagination.ts` — `PaginatedResult<T>`, `PaginationCursor`, `OffsetPaginationParams`, `CursorInvalidError`
- `utility.ts` — `CreateInput<T>`, `UpdateInput<T>`, `DeepReadonly<T>`, `DateRange`, `AuditMetadata`, `Archived<T>`, `EntityReference`
- `timestamps.ts` — `UnixMillis`, `ISOTimestamp`, `toUnixMillis`, `toUnixMillisOrNull`
- `api-constants.ts` — `RATE_LIMITS`, `API_ERROR_CODES`, `PAGINATION`, `SESSION_TIMEOUTS`, `BLOB_SIZE_LIMITS`, `KEY_ROTATION`, and related types
- `server-safe.ts` — `ServerSafe<T>`, `serverSafe()` branding function
- `checksum.ts` — `toChecksumHex()`
- `logger.ts` — `Logger` interface (structural, no concrete implementation)

## Usage

Importing domain types across packages:

```typescript
import type { Member, MemberId, FrontingSession } from "@pluralscape/types";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";

// IDs are nominally typed — MemberId is not assignable from a plain string
function getFrontingSession(memberId: MemberId): FrontingSession {
  /* ... */
}

// createId enforces the prefix contract at runtime
const memberId = createId(ID_PREFIXES.member) as MemberId;
```

Using the server/client encryption boundary:

```typescript
import type { ServerMember, ClientMember } from "@pluralscape/types";
import { serverSafe } from "@pluralscape/types";

// API handlers work with ServerMember (ciphertext fields)
// The mobile app decrypts to ClientMember (plaintext fields)
function respondWithMember(member: ServerMember) {
  return serverSafe(member); // brands the value as verified server-safe
}
```

## Dependencies

`@pluralscape/types` has no runtime `@pluralscape/*` dependencies. It imports only from the
TypeScript standard library (`crypto.randomUUID()`) and the built-in `Date` API.

Dev dependencies (`@pluralscape/eslint-config`, `@pluralscape/tsconfig`) are tooling-only and
not included in consumers' dependency graphs.

## Testing

Unit tests only — no integration variant exists (this package has no I/O boundaries).

```bash
pnpm vitest run --project types
```

Tests are co-located in `src/__tests__/` with one file per source module. Coverage focuses on
runtime utilities (`createId`, `now`, `toISO`, `toUnixMillis`, timestamp conversions, checksum
encoding), discriminated union type guards, and constants. Pure type exports are validated by the
TypeScript compiler via `pnpm typecheck` rather than runtime assertions.
