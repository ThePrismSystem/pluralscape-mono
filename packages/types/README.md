# @pluralscape/types

Shared TypeScript domain types and runtime primitives for the Pluralscape monorepo.

## Overview

This package is the single source of truth for every domain type across the Pluralscape system.
It deliberately contains no business logic and no runtime dependencies beyond the TypeScript
standard library, keeping the dependency graph clean: every other `@pluralscape/*` package
imports from here, never the reverse.

The package solves a concrete problem: Pluralscape is E2E encrypted, and the same conceptual
entity (a member, a fronting session, a journal entry) needs precisely-typed shapes at every
boundary — decrypted on the client, ciphertext-bearing on the server, JSON-serialized on the
wire. Each encrypted entity therefore exposes a canonical six-link chain in its module under
`src/entities/`:

1. `<Entity>` — the full decrypted domain shape used by client code.
2. `<Entity>EncryptedFields` — keys-union of fields that get encrypted client-side.
3. `<Entity>EncryptedInput = Pick<<Entity>, <Entity>EncryptedFields>` — what the
   client encrypts and submits to `encryptedData`.
4. `<Entity>ServerMetadata` — the Drizzle row shape (plaintext columns + opaque
   `encryptedData` blob + any `ServerInternal<T>`-marked server-only fields).
5. `<Entity>Result = EncryptedWire<<Entity>ServerMetadata>` — server JS-runtime
   response, with `encryptedData` branded as `EncryptedBase64`.
6. `<Entity>Wire = Serialize<<Entity>Result>` — the JSON-serialized HTTP shape.
   Brands strip, `UnixMillis` becomes `number`, `EncryptedBase64` collapses to `string`.

`EncryptedWire<T>` (in `encrypted-wire.ts`) is the canonical encrypted-payload type at decrypt
boundaries: it is the shape API handlers and clients hand to the crypto layer, with the opaque
`encryptedData` blob branded as `EncryptedBase64`. Plaintext entities skip steps 2, 3, and 5
and expose only `<Entity>`, `<Entity>ServerMetadata`, and `<Entity>Wire`. Class C entities
(divergent encrypted payload not derivable from the domain shape) declare an auxiliary
`<Entity>EncryptedPayload` type — see ADR-023 for the taxonomy.

`__sot-manifest__.ts` registers every entity's slots and is consumed by parity gates in
`@pluralscape/db`, `@pluralscape/validation`, and the OpenAPI-Wire type test (run via
`pnpm types:check-sot`, which typechecks `@pluralscape/types`, the Drizzle parity tests, the
Zod parity tests, and the OpenAPI-Wire parity tests). Adding an entity to the manifest forces
Drizzle, Zod, and OpenAPI generators to stay in lockstep with the canonical type. As of M9a,
33 encrypted entities and the surrounding plaintext entities are wired through the manifest.
See [ADR-023](../../docs/adr/023-zod-type-alignment.md) for the `ServerInternal<T>` marker
convention and the Class A/B/C taxonomy, and [ADR-038](../../docs/adr/038-three-drizzle-schema-sets.md)
for how the same canonical types feed three Drizzle schema sets (server PG, client SQLite,
local-cache SQLite).

A second key design decision is nominal typing via `Brand<T, B>`. Every entity ID is a distinct
branded string type (`SystemId`, `MemberId`, `FrontingSessionId`, etc.), preventing cross-entity
ID mix-ups that structural typing would silently permit. The `ID_PREFIXES` constant maps each
entity type to its runtime prefix, which `createId()` in `runtime.ts` enforces at creation time.
Branding extends past IDs to user-visible display strings — see "Branded value types" below.
See [ADR-006](../../docs/adr/006-encryption.md) for the encryption boundary rationale and
[ADR-013](../../docs/adr/013-api-auth-encryption.md) for the server/client data boundary.

## Source Layout

- `src/entities/` — one file per domain entity. The barrel (`entities/index.ts`) is the
  exclusive home for entity-type re-exports; `src/index.ts` simply forwards `export * from
"./entities/index.js"`. Adding a new entity means adding a file under `entities/` and a line
  in the barrel — no edits to `src/index.ts`.
- `src/api-constants/` — split into `api-limits.ts`, `error-codes.ts`, `rate-limits.ts`, and
  `time-constants.ts`, re-exported through `api-constants/index.ts`.
- `src/ids/` — `brand.ts` (the `Brand<T, B>` utility), `prefixes.ts` (`ID_PREFIXES`), and
  `types.ts` (the branded ID aliases), re-exported through `src/ids.ts`.
- `src/i18n/` — `constants.ts` plus the `I18nManifest` shapes, re-exported through
  `src/i18n/index.ts`. The locale and translation primitives live in `src/i18n.ts`.
- `src/__sot-manifest__.ts` — the SoT registry consumed by parity gates.
- `src/__tests__/` — co-located unit tests including the type-level parity gates
  (e.g. `wire-derivation.type.test.ts`).

## Key Exports

### IDs and Branding (`ids.ts`, `brand-utils.ts`, `assert-branded.ts`)

- `Brand<T, B>` — phantom-type utility for nominal typing.
- `SystemId`, `MemberId`, `GroupId`, `FrontingSessionId`, `CustomFrontId` — core identity IDs.
- `BucketId`, `KeyGrantId` — privacy bucket IDs.
- `SessionId`, `AccountId`, `AuthKeyId`, `RecoveryKeyId`, `DeviceTransferRequestId` — auth IDs.
- `SyncDocumentId`, `SyncChangeId`, `SyncSnapshotId` — sync document IDs.
- `BlobId`, `JobId`, `WebhookId`, `TimerId`, and 40+ additional branded ID types.
- `HexColor`, `SlugHash`, `ChecksumHex`, `StorageKey`, `RecoveryKeyDisplay` — branded scalar
  types.
- `ID_PREFIXES` — runtime map of entity type to string prefix (e.g. `"sys_"`, `"mbr_"`).
- `EntityType`, `EntityTypeIdMap`, `AnyBrandedId` — discriminated union of all entity type
  strings and their branded-ID counterparts.
- `AssertAllPrefixesMapped`, `AssertAllEntityTypesMapped` — compile-time exhaustiveness
  guards for the prefix and entity-type maps.
- `brandId<B>(value)` (`brand-utils.ts`) — zero-cost cast from a plain string to a branded ID,
  centralizing the `as XxxId` pattern so branding changes have a single update point.
- `assertBrandedTargetId()`, `InvalidBrandedIdError` (`assert-branded.ts`) — runtime validation
  that an unknown string matches the expected branded-ID prefix.

### Branded value types (`value-types.ts`)

Display-text brands that prevent silent mixing of user-visible strings. Used wherever the
domain demands an unambiguous label or comment:

- `NoteTitle`, `NoteContent`
- `PollTitle`, `PollOptionLabel`
- `FieldDefinitionLabel`
- `FrontingSessionComment`, `FrontingSessionPositionality`, `FrontingSessionOuttrigger`
- `LifecycleEventForm`, `LifecycleEventName`
- `brandValue()` — single helper for narrowing a raw `string` into any of the above.

### Domain entities (`entities/`)

Per-entity files, grouped by the ten plaintext type clusters consolidated under types-ltel
(M9a). Each entity exposes the canonical chain (`<Entity>`, `<Entity>ServerMetadata`,
`<Entity>Wire`, plus the encrypted slots for Class A/B/C entities).

| Cluster                    | Entities                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation                 | `Account`, `System`, `SystemSettings`, `SystemSnapshot`                                                                                                                                                                                                      |
| Auth / Devices             | `Session`, `AuthKey`, `RecoveryKey`, `DeviceTransferRequest`, `DeviceToken`, `ApiKey`                                                                                                                                                                        |
| Members / Identity         | `Member`, `MemberPhoto`                                                                                                                                                                                                                                      |
| Custom Fields              | `FieldDefinition`, `FieldDefinitionScope`, `FieldValue`                                                                                                                                                                                                      |
| Structure                  | `SystemStructureEntityType`, `SystemStructureEntity`, `SystemStructureEntityLink`, `SystemStructureEntityMemberLink`, `SystemStructureEntityAssociation`, `Relationship`, `Group`                                                                            |
| Fronting / Lifecycle       | `FrontingSession`, `FrontingComment`, `CustomFront`, `LifecycleEvent`                                                                                                                                                                                        |
| Innerworld                 | `InnerWorldCanvas`, `InnerWorldEntity`, `InnerWorldRegion`                                                                                                                                                                                                   |
| Communication / Engagement | `Channel`, `ChatMessage` (`message.ts`), `BoardMessage`, `Note`, `Poll`, `PollVote`, `AcknowledgementRequest`, `JournalEntry`, `WikiPage`                                                                                                                    |
| Operational                | `AuditLogEntry`, `BlobMetadata`, `ImportJob`, `ImportEntityRef`, `ExportRequest`, `AccountPurgeRequest`, `WebhookConfig`, `WebhookDelivery`, `TimerConfig`, `CheckInRecord`, `NotificationConfig`, `SyncDocument`, `BucketKeyRotation`, `BucketRotationItem` |
| Privacy / Social           | `Bucket` (privacy bucket), `KeyGrant`, `FriendConnection`, `FriendCode`, `FriendNotificationPreference`                                                                                                                                                      |

The `Bucket` module also exports `BucketContentTag`, the discriminated union covering every
content kind that can be tagged into a bucket (ps-q8vs cleanup).

### Plaintext archival chain (`utility.ts`)

- `Archived<T>` — the archived projection of a plaintext entity.
- `Archivable<T> = T | Archived<T>` — discriminated union over `archived: false | true`.
  Plaintext entities reuse this chain instead of inventing a per-entity archived twin
  (types-0e9j).

### Cross-cutting modules (top-level `src/*.ts`)

| Module                   | What it exports                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `analytics.ts`           | `FrontingAnalytics`, `CoFrontingAnalytics`, `ChartData`, `DateRangeFilter`, `DateRangePreset`, `Duration`, `MemberFrontingBreakdown`, plus the `FrontingReport` six-link chain.                  |
| `nomenclature.ts`        | `NomenclatureSettings` six-link chain, `TermCategory`, `CanonicalTerm`, `TermPreset`, `DEFAULT_TERM_PRESETS`, `createDefaultNomenclatureSettings`.                                               |
| `friend-dashboard.ts`    | `FriendDashboardResponse`, `FriendAccessContext`, `FriendDashboardSyncResponse`, per-entity dashboard projections.                                                                               |
| `friend-export.ts`       | `FriendExportEntity`, `FriendExportManifestResponse`, `FriendExportPageResponse`, `FRIEND_EXPORT_ENTITY_TYPES`, `isFriendExportEntityType`.                                                      |
| `reports.ts`             | `ReportType`, `ReportConfig`, `ReportData`, `BucketExportManifestEntry`, `BucketExportPageResponse`, `REPORT_TYPES`, `isReportType`.                                                             |
| `realtime.ts`            | `WebSocketEvent` discriminated union, `SSEEvent`, `RealtimeSubscription`, `WebSocketConnectionState`.                                                                                            |
| `subscription-events.ts` | `EntityChangeEvent`, `MessageChangeEvent`, `BoardMessageChangeEvent`, `PollChangeEvent`, `AcknowledgementChangeEvent`.                                                                           |
| `search.ts`              | `SearchIndex`, `SearchQuery`, `SearchResult`, `SearchableEntityType`, `SearchResultItem`.                                                                                                        |
| `pk-bridge.ts`           | `PKBridgeConfig`, `PKEntityMapping`, `PKSyncState`, `PKSyncError`, plus the PK sync direction/status enums.                                                                                      |
| `littles-safe-mode.ts`   | `LittlesSafeModeConfig`, `SafeModeUIFlags`, `SafeModeContentItem`.                                                                                                                               |
| `image-source.ts`        | `ImageSource` — the shared shape for client/wire image references.                                                                                                                               |
| `scope-domains.ts`       | `ScopeDomain`, `ScopeTier`, `RequiredScope`, `SCOPE_DOMAINS`, `ALL_API_KEY_SCOPES`.                                                                                                              |
| `jobs.ts`                | `JobType`, `JobStatus`, `JobPayloadMap`, `JobPayload`, `JobDefinition`, `RetryPolicy`, `BackoffStrategy`, `JOB_TYPE_VALUES`, `JOB_STATUS_VALUES`, `EmailTemplateName`.                           |
| `i18n.ts` / `i18n/`      | `Locale`, `TranslationMap`, `LocaleConfig`, `SUPPORTED_LOCALES`, `I18nManifest`, `I18nNamespaceWithEtag`, `Etag`, `asEtag`, plus `I18N_CACHE_TTL_MS`, `I18N_OTA_TIMEOUT_MS`, `I18N_ETAG_LENGTH`. |
| `crypto-keys.ts`         | `KdfMasterKey`.                                                                                                                                                                                  |
| `fronting.constants.ts`  | `MAX_FRONTING_COMMENT_LENGTH`.                                                                                                                                                                   |

### Encryption primitives (`encryption-primitives.ts`)

- `Encrypted`, `BucketEncrypted`, `Plaintext`, `EncryptionAlgorithm`
- `EncryptedBlob`, `T1EncryptedBlob`, `T2EncryptedBlob`, `T3EncryptedBytes`,
  `EncryptedString`, `EncryptedBase64`, `ServerSecret`
- `DecryptFn`, `EncryptFn`

`EncryptedWire<T>` and `PlaintextFields<T>` live in `encrypted-wire.ts` and form the
canonical envelope for handing encrypted server rows to the decrypt boundary. The legacy
`encryption.ts` module was renamed to `encryption-primitives.ts` (PR #539); per-entity
`Server*` / `Client*` wrappers now live in their entity files as `<Entity>ServerMetadata` and
the corresponding domain shape.

### Server-side markers and response unions

- `ServerInternal<T>`, `__serverInternal` (`server-internal.ts`) — phantom-marker convention
  for columns that must never leave the server. The unique-symbol value is re-exported so
  Drizzle table inferences over branded columns can name the resulting type.
- `ServerSafe<T>`, `serverSafe()` (`server-safe.ts`) — branding helper that proves a payload
  has had server-internal fields stripped.
- `ServerResponseData`, `ClientResponseData` (`response-unions.ts`) — discriminated unions
  used in the API/client boundary.

### Shared utilities

- `results.ts` — `Result<T>`, `ApiError`, `ApiErrorResponse`, `ApiResponse`, `ValidationError`.
- `pagination.ts` — `PaginatedResult<T>`, `PaginationCursor`, `OffsetPaginationParams`,
  `CursorInvalidError`.
- `utility.ts` — `CreateInput<T>`, `UpdateInput<T>`, `DeepReadonly<T>`, `DateRange`,
  `AuditMetadata`, `Archived<T>`, `Archivable<T>`, `SortDirection`, `EntityReference`.
- `timestamps.ts` — `UnixMillis`, `ISOTimestamp`, `toUnixMillis`, `toUnixMillisOrNull`.
- `type-assertions.ts` — `Assert`, `Equal`, `Extends`, `Serialize`, `UnbrandedEquivalence`
  (the type-level helpers behind the SoT parity gates).
- `api-constants/` — `RATE_LIMITS`, `API_ERROR_CODES`, `PAGINATION`, `SESSION_TIMEOUTS`,
  `LAST_ACTIVE_THROTTLE_MS`, `BLOB_SIZE_LIMITS`, `FRIEND_CODE`, `AUDIT_RETENTION`,
  `CLIENT_RETRY`, `KEY_ROTATION`, `ROTATION_STATES`, `ROTATION_ITEM_STATUSES`, plus
  `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY` and their config types.
- `checksum.ts` — `toChecksumHex()`.
- `logger.ts` — `Logger` interface (structural, no concrete implementation; the runtime
  logger lives in `@pluralscape/logger`).
- `runtime.ts` — `createId()`, `now()`, `toISO()`, `extractErrorMessage()`.

## Usage

Importing domain types across packages:

```typescript
import type { Member, MemberId, FrontingSession } from "@pluralscape/types";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";

// IDs are nominally typed — MemberId is not assignable from a plain string
function getFrontingSession(memberId: MemberId): FrontingSession {
  /* ... */
}

// createId enforces the prefix contract at runtime; brandId centralizes the cast
const memberId = brandId<MemberId>(createId(ID_PREFIXES.member));
```

Using the canonical encrypted-entity chain:

```typescript
import type {
  Member, // decrypted domain
  MemberEncryptedInput, // = Pick<Member, MemberEncryptedFields>
  MemberServerMetadata, // Drizzle row (server-side only)
  MemberWire, // JSON HTTP response shape
} from "@pluralscape/types";

// Client builds the input from the domain shape, then encrypts:
function buildInput(member: Member): MemberEncryptedInput {
  return { name: member.name, pronouns: member.pronouns /* … */ };
}

// API handlers return MemberWire to clients; never expose
// ServerInternal-marked columns from MemberServerMetadata directly.
async function getMember(id: string): Promise<MemberWire> {
  /* fetch row, serialize, return */
}
```

## Dependencies

`@pluralscape/types` has no runtime `@pluralscape/*` dependencies. It imports only from the
TypeScript standard library (`crypto.randomUUID()`) and the built-in `Date` API.

Dev dependencies (`@pluralscape/eslint-config`, `@pluralscape/tsconfig`, `@types/bun`) are
tooling-only and not included in consumers' dependency graphs.

## Testing

Unit tests only — no integration variant exists (this package has no I/O boundaries).

```bash
pnpm vitest run --project types
```

Tests are co-located in `src/__tests__/` with one file per source module. Coverage focuses on
runtime utilities (`createId`, `now`, `toISO`, `toUnixMillis`, timestamp conversions, checksum
encoding), discriminated union type guards, and constants. Pure type exports are validated by
the TypeScript compiler via `pnpm typecheck`, supplemented by compile-time assertions with
Vitest's `expectTypeOf`. For entities with matching Zod schemas in `@pluralscape/validation`,
contract tests pair `expectTypeOf` checks with runtime `safeParse` assertions so drift between
the type and schema sides is caught immediately.

The cross-package SoT parity gate runs via `pnpm types:check-sot`: it typechecks
`@pluralscape/types`, the Drizzle parity tests in `@pluralscape/db`, the Zod parity tests in
`@pluralscape/validation`, and the OpenAPI-Wire parity tests. Any drift between the
manifest, Drizzle tables, Zod schemas, or generated OpenAPI types fails CI.
