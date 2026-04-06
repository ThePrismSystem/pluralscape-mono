# @pluralscape/sync

Encrypted offline-first CRDT sync over a zero-knowledge relay using Automerge.

## Overview

`@pluralscape/sync` implements the sync layer for Pluralscape's offline-first architecture. Local SQLite is the source of truth; this package is responsible for merging local changes with remote ones and propagating them through an encrypted relay. The server is a dumb relay — it stores and forwards opaque ciphertext and never reads or merges document contents.

CRDT documents are managed with [Automerge](https://automerge.org/). Each logical entity (system core, fronting sessions, journal, etc.) maps to a dedicated Automerge document. Changes are encrypted client-side using per-document symmetric keys from `@pluralscape/crypto` before submission. The relay stores envelopes; clients decrypt and apply them locally.

Conflict resolution happens entirely on-device: Automerge provides last-writer-wins semantics per field for concurrent edits. Post-merge validation runs after each merge to detect application-level inconsistencies (e.g., overlapping fronting sessions) and surfaces them as `ConflictNotification` events rather than silently discarding data. Documents that exceed size or time thresholds are split or compacted automatically.

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

| Import path                      | Contents                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pluralscape/sync/adapters`     | `SqliteStorageAdapter`, `WsNetworkAdapter`, `SqliteOfflineQueueAdapter`, `createWsClientAdapter`, `createBunSqliteDriver`, adapter interfaces                 |
| `@pluralscape/sync/schemas`      | Automerge document schema types (`CrdtSystem`, `CrdtMember`, `CrdtFrontingSession`, `SystemCoreDocument`, `FrontingDocument`, etc.)                           |
| `@pluralscape/sync/protocol`     | Full protocol message taxonomy (`ClientMessage`, `ServerMessage`, `AuthenticateRequest`, `ManifestResponse`, `DocumentUpdate`, `SYNC_PROTOCOL_VERSION`, etc.) |
| `@pluralscape/sync/materializer` | Entity registry, base materializer, `diffEntities`, `applyDiff`, `generateAllDdl`, `createMaterializer`, `registerMaterializer`                               |

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

## Dependencies

**Internal**

- `@pluralscape/crypto` — XChaCha20-Poly1305 encryption, Argon2id key derivation
- `@pluralscape/types` — shared domain types (`SystemId`, `SyncDocumentId`, etc.)
- `@pluralscape/validation` — input validation schemas

**External**

- [`@automerge/automerge`](https://automerge.org/) ^3 — CRDT library (MIT)
- `better-sqlite3-multiple-ciphers` — encrypted SQLite (dev/integration only)

## Testing

```bash
# Unit tests
pnpm vitest run --project sync

# Integration tests (requires SQLite, hits real storage adapters)
pnpm vitest run --project sync-integration
```

Unit tests cover CRDT strategies, encryption round-trips, compaction eligibility, time-split logic, post-merge validation, and the offline queue manager. Integration tests cover the storage adapter, materializer pipeline, and full sync session lifecycle against a real SQLite database.
