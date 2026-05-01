# @pluralscape/data

Client-side data layer: React Query wiring, REST query factories, CRDT bridge, and per-domain crypto transforms for the Pluralscape mobile app.

## Overview

`@pluralscape/data` is the bridge between the mobile app's UI and the two data sources it reads from: the REST API (via `@pluralscape/api-client`) and the offline-first CRDT sync engine (via `@pluralscape/sync`). It provides a configured React Query client, factory functions that produce type-safe query options objects, the materializer subscriber that drives the data-layer write path off sync engine merge events, and the logic for transparently decrypting API responses using the session master key.

Every entity the app works with — members, fronting sessions, channels, notes, polls, innerworld entities, and more — has a corresponding set of crypto transforms in this package. These transforms handle decrypting ciphertext fields from API responses and encrypting plaintext fields before writes, using the XChaCha20-Poly1305 primitives from `@pluralscape/crypto`. Sensitive fields never leave the client in plaintext.

Each transform module owns **functions only** — there are no local domain, wire, or encrypted-input types. Every transform consumes the canonical chain from `@pluralscape/types`: `<Entity>` (decrypted domain), `<Entity>EncryptedFields` (keys union), `<Entity>EncryptedInput = Pick<<Entity>, <Entity>EncryptedFields>`, `<Entity>ServerMetadata` (Drizzle row), `<Entity>Result = EncryptedWire<<Entity>ServerMetadata>` (server JS response), and `<Entity>Wire = Serialize<<Entity>Result>` (HTTP JSON shape). Plaintext entities additionally flow through the discriminated `Archivable<T>` chain so archived/non-archived branches are statically distinguished. Runtime validation of decrypted blobs is delegated to the matching `<Entity>EncryptedInputSchema` from `@pluralscape/validation` — transforms call `Schema.parse(decrypted)` and rely on Zod errors when the ciphertext doesn't match the expected shape. Hand-rolled `assertX` validators have been removed; the friend-dashboard T2 blobs likewise validate through `FriendDashboard*BlobSchema` in `@pluralscape/validation`.

This package has no runtime dependency on React Native or Expo and does not import any UI primitives. It is consumed by the `apps/mobile` Expo app but is kept framework-agnostic so it can be tested in a plain Node/Vitest environment.

## Key Exports

### Query client

```ts
import { createAppQueryClient } from "@pluralscape/data";
```

`createAppQueryClient()` — returns a pre-configured `QueryClient` with opinionated defaults: 30-second stale time, 5-minute GC window, 2 retries on queries, 1 on mutations, and `refetchOnWindowFocus`/`refetchOnReconnect` enabled.

### REST query factory

```ts
import { createRestQueryFactory } from "@pluralscape/data";
```

`createRestQueryFactory(deps)` — given an `ApiClient` and a `getMasterKey` accessor, returns a factory whose `queryOptions()` method produces a `{ queryKey, queryFn }` object ready to pass to `useQuery`. The overloaded signature accepts an optional `decrypt` callback; when provided, the raw API response is passed through it together with the live master key before the data is cached.

### CRDT query bridge

```ts
import { createCrdtQueryBridge } from "@pluralscape/data";
```

`createCrdtQueryBridge(deps)` — wraps the sync engine's `getDocumentSnapshot` behind a React Query `queryFn`, projecting a typed view from the raw document using a caller-supplied `project` function.

### Materializer subscriber

```ts
import { createMaterializerSubscriber } from "@pluralscape/data";
```

`createMaterializerSubscriber(deps)` — subscribes to the sync engine's `sync:changes-merged` and `sync:snapshot-applied` events on the shared event bus and runs the registered materializer (looked up via `getMaterializer` from `@pluralscape/sync/materializer`) for the affected document. `changes-merged` is materialised with the dirty-entity-type filter; `snapshot-applied` runs a full pass. Each merge runs inside a single `materializerDb.transaction(...)` so readers never observe a half-merged state. `NoActiveSessionError` from a session evicted mid-flight is treated as a benign race; any other snapshot read or materializer write error is reported via `sync:error` rather than thrown out of the bus dispatch. Returns a `dispose()` handle that unsubscribes both listeners. This is the wiring that connects the sync engine to the data-layer write path (sync-xjfi).

### API error type

```ts
import { ApiClientError } from "@pluralscape/data";
```

`ApiClientError` — thrown by the REST query factory when the API client returns a non-2xx response. Carries the HTTP status and parsed error body so callers can branch on specific failures.

### Session and API-key helpers

```ts
import {
  decryptDeviceInfo,
  withDecryptedDeviceInfo,
  decryptApiKeyPayload,
  encryptApiKeyPayload,
  withDecodedApiKeyPayload,
} from "@pluralscape/data";
```

- `decryptDeviceInfo(row, masterKey)` — decrypts the encrypted device-info field on a session-list row. `withDecryptedDeviceInfo(rows, masterKey)` is the page-level helper used by the session-list endpoint (api-bqu4).
- `decryptApiKeyPayload` / `encryptApiKeyPayload` — round-trip the API-key payload blob. `withDecodedApiKeyPayload(rows, masterKey)` is the matching list helper.

### Crypto transforms (per domain)

Every transform module is available as a granular sub-path import (e.g. `@pluralscape/data/transforms/member` — see the `exports` field in `package.json` for the full list). A commonly used subset is also re-exported from the root entry for convenience; transforms not in the root re-export table below must be imported via their sub-path.

**Re-exported from `@pluralscape/data`:**

| Domain        | Transforms                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System        | `decryptSystemSettings`, `encryptSystemSettingsUpdate`, `decryptNomenclature`, `encryptNomenclatureUpdate`                                                                                                 |
| Members       | `decryptMember`, `decryptMemberPage`, `encryptMemberInput`, `encryptMemberUpdate`                                                                                                                          |
| Groups        | `decryptGroup`, `decryptGroupPage`, `encryptGroupInput`, `encryptGroupUpdate`                                                                                                                              |
| Custom fronts | `decryptCustomFront`, `decryptCustomFrontPage`, `encryptCustomFrontInput`, `encryptCustomFrontUpdate`                                                                                                      |
| Custom fields | `decryptFieldDefinition`, `decryptFieldDefinitionPage`, `encryptFieldDefinitionInput`, `decryptFieldValue`, `decryptFieldValueList`, `encryptFieldValueInput`                                              |
| Fronting      | `decryptFrontingSession{,Page}`, `encryptFrontingSessionInput/Update`, `decryptFrontingComment{,Page}`, `encryptFrontingCommentInput/Update`, `decryptFrontingReport{,Page}`, `encryptFrontingReportInput` |
| Timers        | `decryptTimerConfig{,Page}`, `encryptTimerConfigInput/Update`, `decryptCheckInRecord{,Page}`                                                                                                               |
| Communication | `decryptChannel`, `decryptMessage`, `decryptBoardMessage`, `decryptPoll`, `decryptPollVote`, `decryptNote`, `decryptAcknowledgement` (each with `*Page` + matching encrypt helpers)                        |
| Privacy       | `decryptPrivacyBucket`, `decryptPrivacyBucketPage`, `encryptBucketInput`, `encryptBucketUpdate`                                                                                                            |
| Blobs         | `decodeAndDecryptT1`, `encryptAndEncodeT1`, `encryptInput`, `encryptUpdate`                                                                                                                                |

**Sub-path only** (import from `@pluralscape/data/transforms/<name>`):

| Domain         | Module                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure      | `structure-entity`, `structure-entity-type`                                                                                                                                                   |
| Relationships  | `relationship`                                                                                                                                                                                |
| Innerworld     | `innerworld-entity`, `innerworld-region`, `innerworld-canvas`                                                                                                                                 |
| Lifecycle      | `lifecycle-event`, `snapshot`                                                                                                                                                                 |
| Social         | `friend-code`, `friend-connection`, `friend-dashboard`                                                                                                                                        |
| Notifications  | `notification-config`, `device-token`                                                                                                                                                         |
| Shared helpers | `decode-blob` (exports `decodeAndDecryptT1`, `encryptAndEncodeT1`, `encryptInput`, `encryptUpdate`, `decodeAndDecryptT2`, `encryptAndEncodeT2`, `extractT2BucketId`, `base64urlToUint8Array`) |

Every `decrypt*` function passes the decrypted blob through `<Entity>EncryptedInputSchema.parse()` from `@pluralscape/validation` — missing fields, wrong types, or non-object payloads throw a `ZodError` so ciphertext corruption, key mismatch, or server tampering surfaces as an error rather than silent data loss. Encrypt/decrypt pairs round-trip — e.g. `encryptBucketInput` followed by `decryptPrivacyBucket` reproduces the original plaintext. Base64 encode/decode inside `decode-blob.ts` is backed by Node's `Buffer` API for linear-time conversion.

## Usage

### Setting up the query client and REST factory

```ts
import { createAppQueryClient, createRestQueryFactory } from "@pluralscape/data";
import { createApiClient } from "@pluralscape/api-client";

const queryClient = createAppQueryClient();

const restQuery = createRestQueryFactory({
  apiClient: createApiClient({ baseUrl: "https://api.example.com" }),
  getMasterKey: () => sessionStore.masterKey,
});

// In a React component:
const memberOpts = restQuery.queryOptions({
  queryKey: ["member", memberId],
  path: "/v1/members/{id}",
  init: { params: { path: { id: memberId } } },
  decrypt: (raw, masterKey) => decryptMember(raw, masterKey),
});

const { data: member } = useQuery(memberOpts);
```

### Reading from the CRDT sync engine

```ts
import { createCrdtQueryBridge } from "@pluralscape/data";

const bridge = createCrdtQueryBridge({ engine: syncEngine });

const snapshotOpts = bridge.documentQueryOptions({
  queryKey: ["snapshot", documentId],
  documentId,
  project: (doc) => projectSnapshot(doc),
});

const { data: snapshot } = useQuery(snapshotOpts);
```

## Dependencies

| Package                   | Role                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@pluralscape/api-client` | Generated OpenAPI fetch client — provides typed `GET` (and other methods) used by the REST query factory        |
| `@pluralscape/crypto`     | `KdfMasterKey` type and low-level decrypt/encrypt primitives used by all transform modules                      |
| `@pluralscape/sync`       | `SyncDocumentId` type; the CRDT bridge accepts any object implementing `getDocumentSnapshot` from this package  |
| `@pluralscape/types`      | Shared domain types consumed by transforms and the CRDT bridge                                                  |
| `@pluralscape/validation` | `<Entity>EncryptedInputSchema` and friend-dashboard blob schemas used to validate decrypted payloads at runtime |
| `@tanstack/react-query`   | `QueryClient`, `QueryKey`, and `useQuery` — the caching layer this package configures and integrates with       |

React `>=19.0.0` is a peer dependency (required by React Query v5).

## Testing

Run unit tests from the monorepo root:

```bash
pnpm vitest run --project data
```

There is no integration variant — all tests are unit tests that run in a Vitest/Node environment with no network or database I/O.

The test suite covers:

- `createAppQueryClient` — verifies the configured default options (stale time, GC time, retry counts).
- `createRestQueryFactory` — covers successful decrypted and plain fetches, missing master key, and API error propagation.
- `createCrdtQueryBridge` — verifies that `documentQueryOptions` projects snapshots correctly and throws when the document is not loaded.
- `createMaterializerSubscriber` — covers `sync:changes-merged` and `sync:snapshot-applied` dispatch, the dirty-entity-type filter, transactional materialisation, the `NoActiveSessionError` race skip, `sync:error` emission for snapshot/materializer failures, and `dispose()` idempotency.
- Session helpers (`session`, `session-helpers`) and API-key helpers (`api-key`, `api-key-helpers`) cover encrypted device-info and payload decode plus the page-level wrappers.
- Every transform module has a dedicated spec under `src/transforms/__tests__/` that exercises the encrypt → decrypt round-trip, the archived/non-archived branches of `Archivable<T>`, pagination, and the Zod-schema validation paths (missing fields, wrong types, non-object blobs).
