# @pluralscape/sync

Encrypted offline-first CRDT sync over a zero-knowledge relay using Automerge.

## Overview

`@pluralscape/sync` implements the sync layer for Pluralscape's offline-first architecture. Local SQLite is the source of truth; this package is responsible for merging local changes with remote ones and propagating them through an encrypted relay. The server is a dumb relay — it stores and forwards opaque ciphertext and never reads or merges document contents.

CRDT documents are managed with [Automerge](https://automerge.org/). Each logical entity (system core, fronting, chat, journal, notes, privacy config, bucket projections) maps to a dedicated Automerge document. The full entity coverage — including webhook configs and friend connections — lives in `ENTITY_CRDT_STRATEGIES`. Changes are encrypted client-side using per-document symmetric keys from `@pluralscape/crypto` before submission. The relay stores envelopes; clients decrypt and apply them locally.

Every envelope (change and snapshot) is Ed25519-signed by the author and the signature is verified before decryption. The envelope's `authorPublicKey` is mixed into the AEAD additional data, cryptographically binding the advertised public key to the ciphertext — swapping the public key after the fact produces `KeyBindingMismatchError` on decrypt. Snapshot envelopes additionally commit to a big-endian `snapshotVersion` to prevent cross-version replay. Document access is authorised via the document key resolver, which maps document IDs to bucket keys and refuses unknown buckets with `BucketKeyNotFoundError`.

Conflict resolution happens entirely on-device: Automerge provides last-writer-wins semantics per field for concurrent edits. Post-merge validation runs after each merge to detect application-level inconsistencies (e.g., overlapping fronting sessions) and surfaces them as `ConflictNotification` events rather than silently discarding data. Validators live under `src/validators/` split by concern (fronting, hierarchy cycles, sort order, check-in, friend connection, timer config, webhook config, tombstones, bucket content tags) and are aggregated by `runAllValidations`. Documents that exceed size or time thresholds are split or compacted automatically.

Incoming changes are materialised into the local-cache SQLite schema through per-document materializers (ADR-038 three-schema-set split: server PG, client SQLite, local-cache SQLite). Each merge carries a `dirtyEntityTypes` hint so only entity types whose CRDT fields actually changed are queried and diffed — clean types issue zero SQL. Hot-path entity writes emit `materialized:entity` events for downstream query invalidation. The data layer wires the materializer registry into the sync write path via `createMaterializerSubscriber` (in `@pluralscape/data`), which subscribes to `SyncChangesMergedEvent` / `SyncSnapshotAppliedEvent` on the event bus. Brand-aware merge logic uses canonical branded types from `@pluralscape/types`.

## Key Exports

All imports below are from `@pluralscape/sync` unless noted.

**Engine**

- `SyncEngine` / `SyncEngineConfig` — top-level orchestrator; manages sessions, compaction, and the offline queue

**Sessions**

- `EncryptedSyncSession` — single-device sync session over a transport
- `syncThroughRelay` — convenience function for one-shot relay sync

**Document factories**

- `createDocument`, `createSystemCoreDocument`, `createFrontingDocument`, `createChatDocument`, `createJournalDocument`, `createNoteDocument`, `createPrivacyConfigDocument`, `createBucketDocument`, `fromDoc`

**Encryption**

- `encryptChange` / `decryptChange`, `encryptSnapshot` / `decryptSnapshot`, `verifyEnvelopeSignature`
- `SignatureVerificationError`, `KeyBindingMismatchError`, `EncryptionKeyMismatchError` — distinguish signature forgery, author-key binding mismatch, and benign key-desync decrypt failures

**Conflict resolution**

- `runAllValidations` — post-merge validation returning `PostMergeValidationResult`
- `ConflictNotification`, `ConflictResolutionStrategy`, `ConflictPersistenceAdapter`

**Offline queue**

- `replayOfflineQueue` / `ReplayOfflineQueueConfig` / `ReplayResult`

**Document lifecycle**

- `checkCompactionEligibility`, `LazyDocumentSizeTracker`
- `splitDocument`, `checkTimeSplitEligibility`, `computeNewDocumentId`
- `checkStorageBudget`, `selectEvictionCandidates`

**Events**

- `createEventBus` — typed event bus (`DataLayerEvent`, `SyncChangesMergedEvent`, `WsSyncMessageEvent`, etc.)

**Sub-entry points**

| Import path                      | Contents                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pluralscape/sync/adapters`     | `SqliteStorageAdapter`, `WsNetworkAdapter`, `SqliteOfflineQueueAdapter`, `createWsClientAdapter`, `createBunSqliteDriver`, `runAsyncTransaction`, adapter interfaces (`SqliteDriver`, `SqliteStatement`) |
| `@pluralscape/sync/schemas`      | Automerge document schema types (`CrdtSystem`, `CrdtMember`, `CrdtFrontingSession`, `SystemCoreDocument`, `FrontingDocument`, etc.)                                                                      |
| `@pluralscape/sync/protocol`     | Full protocol message taxonomy (`ClientMessage`, `ServerMessage`, `AuthenticateRequest`, `ManifestResponse`, `DocumentUpdate`, `SYNC_PROTOCOL_VERSION`, etc.)                                            |
| `@pluralscape/sync/materializer` | Entity registry, base materializer, `diffEntities`, `applyDiff`, `generateAllDdl`, `createMaterializer`, `registerMaterializer`                                                                          |

## Usage

**Bootstrapping the sync engine**

```ts
import { SyncEngine } from "@pluralscape/sync";
import {
  SqliteStorageAdapter,
  SqliteOfflineQueueAdapter,
  createBunSqliteDriver,
  createWsClientAdapter,
} from "@pluralscape/sync/adapters";

const driver = createBunSqliteDriver(db);
const storage = new SqliteStorageAdapter(driver);
const offlineQueue = new SqliteOfflineQueueAdapter(driver);
const wsAdapter = createWsClientAdapter({ url: "wss://relay.example.com/sync" });

const engine = new SyncEngine({
  storage,
  offlineQueue,
  network: wsAdapter,
  keyResolver, // DocumentKeyResolver instance
  eventBus, // EventBus from createEventBus()
});

await engine.start();
```

**Encrypting and submitting a change**

```ts
import { encryptChange, encryptSnapshot } from "@pluralscape/sync";

const envelope = await encryptChange(change, {
  documentKey,
  deviceId,
  systemId,
});

// envelope is an EncryptedChangeEnvelope — safe to relay to the server
```

## SQLite drivers

The `SqliteDriver` contract is fully async — every `run` / `all` / `get` / `exec` / `transaction` / `close` returns a `Promise`. Sync-native backends (`bun:sqlite`, `expo-sqlite`, `better-sqlite3-multiple-ciphers`) wrap their synchronous calls with `Promise.resolve`; the overhead is one microtask per call. This contract is required so the web build can talk to an OPFS-backed wa-sqlite driver over `postMessage`, where every call is inherently async.

This package ships `createBunSqliteDriver` (bun:sqlite) and `runAsyncTransaction` (shared `BEGIN`/`COMMIT`/`ROLLBACK` helper with `AggregateError` for rollback-on-rollback). The expo-sqlite driver and the OPFS web-worker driver live in `apps/mobile/src/platform/drivers/` alongside the platform detection that chooses between them.

Nested transactions are rejected synchronously at the driver level — callers must guard their own re-entry.

## Dependencies

**Internal**

- `@pluralscape/crypto` — XChaCha20-Poly1305 encryption, Argon2id key derivation
- `@pluralscape/db` — local-cache SQLite schema definitions (consumed by materializer DDL)
- `@pluralscape/types` — canonical branded domain types (`SystemId`, `SyncDocumentId`, etc.)
- `@pluralscape/validation` — input validation schemas

**External**

- [`@automerge/automerge`](https://automerge.org/) ^3 — CRDT library (MIT)
- `drizzle-orm` — schema bridge for materializer DDL generation
- `better-sqlite3-multiple-ciphers` — encrypted SQLite (dev/integration only)

## Testing

```bash
# Unit tests
pnpm vitest run --project sync

# Integration tests (requires SQLite, hits real storage adapters)
pnpm vitest run --project sync-integration
```

Unit tests cover CRDT strategies, encryption round-trips, compaction eligibility, time-split logic, post-merge validation, and the offline queue manager. Integration tests cover the storage adapter, materializer pipeline, and full sync session lifecycle against a real SQLite database.
