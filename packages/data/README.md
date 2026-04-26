# @pluralscape/data

Client-side data layer: React Query wiring, REST query factories, CRDT bridge, and per-domain crypto transforms for the Pluralscape mobile app.

## Overview

`@pluralscape/data` is the bridge between the mobile app's UI and the two data sources it reads from: the REST API (via `@pluralscape/api-client`) and the offline-first CRDT sync engine (via `@pluralscape/sync`). It provides a configured React Query client, factory functions that produce type-safe query options objects, and the logic for transparently decrypting API responses using the session master key.

Every entity the app works with — members, fronting sessions, channels, notes, polls, innerworld entities, and more — has a corresponding set of crypto transforms in this package. These transforms handle decrypting ciphertext fields from API responses and encrypting plaintext fields before writes, using the XChaCha20-Poly1305 primitives from `@pluralscape/crypto`. Sensitive fields never leave the client in plaintext.

Each transform module owns **functions only** — there are no local domain, wire, or encrypted-input types. Every transform consumes the canonical chain from `@pluralscape/types`: `<Entity>` (decrypted domain), `<Entity>EncryptedFields` (keys union), `<Entity>EncryptedInput = Pick<<Entity>, <Entity>EncryptedFields>`, `<Entity>ServerMetadata` (Drizzle row), `<Entity>Result = EncryptedWire<<Entity>ServerMetadata>` (server JS response), and `<Entity>Wire = Serialize<<Entity>Result>` (HTTP JSON shape). Runtime validation of decrypted blobs is delegated to the matching `<Entity>EncryptedInputSchema` from `@pluralscape/validation` — transforms call `Schema.parse(decrypted)` and rely on Zod errors when the ciphertext doesn't match the expected shape. Hand-rolled `assertX` validators have been removed.

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
| Social         | `friend-code`, `friend-dashboard`                                                                                                                                                             |
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

| Package                   | Role                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@pluralscape/api-client` | Generated OpenAPI fetch client — provides typed `GET` (and other methods) used by the REST query factory       |
| `@pluralscape/crypto`     | `KdfMasterKey` type and low-level decrypt/encrypt primitives used by all transform modules                     |
| `@pluralscape/sync`       | `SyncDocumentId` type; the CRDT bridge accepts any object implementing `getDocumentSnapshot` from this package |
| `@pluralscape/types`      | Shared domain types consumed by transforms and the CRDT bridge                                                 |
| `@tanstack/react-query`   | `QueryClient`, `QueryKey`, and `useQuery` — the caching layer this package configures and integrates with      |

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
- Every transform module has a dedicated spec under `src/transforms/__tests__/` that exercises the encrypt → decrypt round-trip, the archived/non-archived branches, pagination, and the field assertions (missing fields, wrong types, non-object blobs).
