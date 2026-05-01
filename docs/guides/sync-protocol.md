# Sync Protocol Reference

> Audience: developers implementing the sync client (mobile, web). For a high-level overview, see the [API Consumer Guide](api-consumer-guide.md#6-sync-protocol).

Pluralscape uses an encrypted CRDT sync protocol for offline-first data synchronization. The server is an encrypted relay -- it stores and forwards ciphertext without ever seeing plaintext content. All encryption and decryption happen on the client.

The protocol is transport-agnostic. The primary transport is WebSocket; HTTP long-polling is a fallback. The wire format is JSON with binary fields (ciphertext, nonces, signatures, public keys) encoded as Base64url strings.

---

## 1. WebSocket Connection

**Endpoint:**

```
wss://{host}/v1/sync/ws
```

**Subprotocol:** `pluralscape-sync-v1` (declared during the WebSocket upgrade handshake).

**Authentication:** the client authenticates after the WebSocket connection is established by sending an `AuthenticateRequest` message containing the session token (the same `ps_sess_...` token used for REST). The token is sent inside the message payload, not as a query parameter or header. The server closes the connection if no `AuthenticateRequest` arrives within 10 seconds.

**Connection limits:** see [`docs/api-limits.md`](../api-limits.md#websocket-sync-limits) for current values.

**Heartbeat:** the server sends application-level Ping messages every 30 seconds. If no Pong is received within 10 seconds, the connection is closed. This detects silent disconnects that TCP keepalive might miss.

## 2. Session Lifecycle

The sync session follows a strict handshake sequence:

```
Client                                Server
  |                                     |
  |-- AuthenticateRequest ------------->|  session token + systemId + profileType
  |<-- AuthenticateResponse ------------|  syncSessionId + serverTime
  |                                     |
  |-- ManifestRequest ----------------->|  request filtered document list
  |<-- ManifestResponse ----------------|  manifest of all sync documents
  |                                     |
  |-- SubscribeRequest ---------------->|  local sync positions per document
  |<-- SubscribeResponse ---------------|  catch-up changes + snapshots
  |                                     |
  |         --- steady state ---        |
  |<-- DocumentUpdate ------------------|  server pushes new changes
  |-- SubmitChangeRequest ------------->|  client submits encrypted change
  |<-- ChangeAccepted ------------------|  server confirms with assigned seq
  |<-- ManifestChanged -----------------|  manifest updated (new doc, grant)
```

**Ordering requirements:**

1. `AuthenticateRequest` must be the first message. Anything else before authentication produces `SyncError { code: "AUTH_FAILED" }` and a connection close.
2. `ManifestRequest` must precede `SubscribeRequest`.
3. After the handshake, messages flow concurrently -- there is no strict turn-taking.

**Protocol version:** `AuthenticateRequest` declares `protocolVersion: 1`. If the server does not support the client's version, it responds with `SyncError { code: "PROTOCOL_MISMATCH" }` and closes.

## 3. Message Types

Every message shares a common base:

```json
{
  "type": "AuthenticateRequest",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`correlationId` is a client-generated UUID that the server echoes on direct responses. Server-pushed messages (`DocumentUpdate`, `ManifestChanged`) set `correlationId` to `null`.

**Client -> Server (9 message types):**

| Type                    | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `AuthenticateRequest`   | Present session token, systemId, and replication profile type |
| `ManifestRequest`       | Request the filtered sync manifest                            |
| `SubscribeRequest`      | Subscribe to documents with local sync positions              |
| `UnsubscribeRequest`    | Cancel real-time subscription for a document                  |
| `FetchSnapshotRequest`  | Request the latest encrypted snapshot                         |
| `FetchChangesRequest`   | Request changes since a given seq                             |
| `SubmitChangeRequest`   | Submit a new encrypted change envelope                        |
| `SubmitSnapshotRequest` | Submit a new encrypted snapshot (compaction)                  |
| `DocumentLoadRequest`   | Load a non-subscribed document on demand                      |

**Server -> Client (10 message types):**

| Type                   | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `AuthenticateResponse` | Session established; returns syncSessionId and serverTime             |
| `ManifestResponse`     | Returns the filtered manifest                                         |
| `SubscribeResponse`    | Confirms subscriptions with per-document catch-up data                |
| `DocumentUpdate`       | Real-time push of new changes (server-initiated, correlationId: null) |
| `SnapshotResponse`     | Returns requested snapshot                                            |
| `ChangesResponse`      | Returns requested changes                                             |
| `ChangeAccepted`       | Confirms change acceptance with server-assigned seq                   |
| `SnapshotAccepted`     | Confirms snapshot acceptance                                          |
| `ManifestChanged`      | Push notification that the manifest changed (server-initiated)        |
| `SyncError`            | Error response for any failed request                                 |

## 4. Replication Profiles

The `AuthenticateRequest` declares a `profileType` that determines which documents the client receives:

| Profile      | Receives                                    | Use Case                                       |
| ------------ | ------------------------------------------- | ---------------------------------------------- |
| `owner-full` | All documents (active + archived)           | Primary devices with no storage constraints    |
| `owner-lite` | Current-period documents + active channels  | Low-storage devices (wearables, budget phones) |
| `friend`     | Only bucket documents with active KeyGrants | Friends viewing shared content                 |

**Owner-lite filtering:** system-core, privacy-config, and bucket documents are always included. Fronting documents include only the current time period. Chat channels are included only if updated within the active channel window (default: 30 days). Journal and note documents are excluded (available on demand). Historical documents for all types are available via `DocumentLoadRequest`.

**Friend filtering:** the server filters the manifest before delivery, returning only bucket documents for which the friend has a non-revoked KeyGrant. Friends cannot access system-core, chat, journal, or other document types.

## 5. Document Model

The sync layer uses **Automerge CRDT** documents. Each document is identified by a string ID following a naming convention:

| Document Type    | ID Format                       | Time-Split | Encryption Key          |
| ---------------- | ------------------------------- | ---------- | ----------------------- |
| `system-core`    | `system-core-{systemId}`        | None       | Derived from master key |
| `fronting`       | `fronting-{systemId}[-YYYY-QN]` | Quarter    | Derived from master key |
| `chat`           | `chat-{channelId}[-YYYY-MM]`    | Month      | Derived from master key |
| `journal`        | `journal-{systemId}[-YYYY]`     | Year       | Derived from master key |
| `note`           | `note-{systemId}[-YYYY]`        | Year       | Derived from master key |
| `privacy-config` | `privacy-config-{systemId}`     | None       | Derived from master key |
| `bucket`         | `bucket-{bucketId}`             | None       | Bucket key              |

**Time-splitting:** documents that grow over time (fronting, chat, journal, note) are split into time-bounded segments when they exceed a size threshold. The split thresholds are: fronting 5 MiB, chat 5 MiB, journal 10 MiB, note 10 MiB.

**Encrypted relay model:** the server never sees plaintext Automerge data. The client:

1. Makes a local Automerge change.
2. Extracts the binary change bytes.
3. Encrypts them with the document's encryption key (XChaCha20-Poly1305).
4. Signs the encrypted envelope with the Ed25519 signing key.
5. Sends the `EncryptedChangeEnvelope` to the server.

The server validates the signature, assigns a monotonically increasing `seq` number, stores the ciphertext, and relays to other subscribed clients. It never decrypts the content.

**Encrypted change envelope:**

```json
{
  "ciphertext": "<base64url>",
  "nonce": "<base64url, 24 bytes>",
  "signature": "<base64url, 64 bytes>",
  "authorPublicKey": "<base64url, 32 bytes>",
  "documentId": "system-core-sys_abc",
  "seq": 42
}
```

**Encrypted snapshot envelope** (for compaction):

```json
{
  "ciphertext": "<base64url>",
  "nonce": "<base64url>",
  "signature": "<base64url>",
  "authorPublicKey": "<base64url>",
  "documentId": "system-core-sys_abc",
  "snapshotVersion": 5
}
```

## 6. Sync Manifest

The manifest is a plaintext listing of all sync documents for a system. It contains only metadata -- no encrypted content:

```json
{
  "systemId": "sys_abc",
  "documents": [
    {
      "docId": "system-core-sys_abc",
      "docType": "system-core",
      "keyType": "derived",
      "bucketId": null,
      "channelId": null,
      "timePeriod": null,
      "createdAt": 1711843260000,
      "updatedAt": 1711843260000,
      "sizeBytes": 102400,
      "snapshotVersion": 3,
      "lastSeq": 42,
      "archived": false
    }
  ]
}
```

The client uses the manifest to determine which documents to subscribe to (via the replication profile filter), which documents are available for on-demand loading, and which local documents should be evicted (no longer in the manifest).

When the server pushes a `ManifestChanged` message, the client must re-fetch the full manifest to get accurate state. The `hint` field on `ManifestChanged` is informational only.

## 7. Subscription and Catch-Up

After receiving the manifest, the client sends a `SubscribeRequest` declaring its local sync positions:

```json
{
  "type": "SubscribeRequest",
  "correlationId": "...",
  "documents": [
    {
      "docId": "system-core-sys_abc",
      "lastSyncedSeq": 38,
      "lastSnapshotVersion": 2
    }
  ]
}
```

The server computes catch-up data per document and responds with:

```json
{
  "type": "SubscribeResponse",
  "correlationId": "...",
  "catchup": [
    {
      "docId": "system-core-sys_abc",
      "changes": [
        /* envelopes with seq 39..42 */
      ],
      "snapshot": null
    }
  ],
  "droppedDocIds": []
}
```

- `catchup` is omitted for documents where the client is already current.
- `snapshot` is present only when the server holds a newer snapshot than the client's `lastSnapshotVersion`. The client should bootstrap from the snapshot, then apply the provided changes.
- `droppedDocIds` lists document IDs dropped because the subscription cap (100 per request, 500 per connection) was reached. Dropped documents must be loaded on demand.

**On-demand loading:** for documents not in the active subscription set (historical periods, lite-profile journals), the client sends `DocumentLoadRequest`. The server responds with `SnapshotResponse` + `ChangesResponse` for that document, subject to the same access checks as subscription.

## 8. Steady-State Sync

After the handshake, the change submission cycle is:

1. Client creates a local Automerge change, encrypts it, sends `SubmitChangeRequest`.
2. Server validates the envelope signature, assigns `seq`, stores the ciphertext.
3. Server sends `ChangeAccepted { assignedSeq }` to the submitting client.
4. Server broadcasts `DocumentUpdate` with the new envelope to all other subscribed clients.

**Change deduplication:** the server deduplicates by `(docId, authorPublicKey, nonce)`. Submitting the same change twice is safe and idempotent.

**Compaction:** when a document accumulates too many changes (default threshold: 200 changes or 1 MiB size increase), the client compacts by saving the full Automerge state as an encrypted snapshot and submitting it via `SubmitSnapshotRequest`. The server accepts only if `snapshotVersion` strictly exceeds the current value. Concurrent compaction from two devices: the higher version wins; the lower gets `VERSION_CONFLICT`.

**Rate limiting:** see [`docs/api-limits.md`](../api-limits.md#websocket-sync-limits) for WebSocket rate limits. After 10 consecutive rate limit strikes, the server closes the connection.

**Client-side materialization:** decrypted Automerge state is projected into a local SQLite **client cache** for query access. The client-cache schema is one of the three Drizzle schema sets defined in [ADR-038](../adr/038-three-drizzle-schema-sets.md) (server PG, server SQLite, client-cache SQLite); cache tables hold the decrypted projection plus FTS5 indexes for search. The materializer registry (`packages/sync/src/materializer/materializer-registry.ts`) maps each `docType` to a domain materializer, and `createMaterializerSubscriber` (in `@pluralscape/data`) subscribes to the sync engine and writes into the cache on every applied change. Materialization runs in the data-layer write path -- the same observer feeds the React Query invalidator so UI updates flow without manual refetch.

## 9. Offline Queue

When the client is disconnected, local changes are queued in an offline queue (SQLite-backed on mobile). On reconnect:

1. The client re-authenticates, re-fetches the manifest, re-subscribes with current local seq positions.
2. The offline queue is drained in batches (up to 500 entries per batch).
3. Entries are grouped by document and replayed serially within each document to preserve causal ordering.
4. Up to 3 documents are replayed concurrently.
5. Each entry is retried up to 3 times with exponential backoff (500 ms base, 0.5-1.0x jitter).
6. Non-retriable errors (4xx except 408/429) fail the entry immediately.
7. If an entry fails, all causally-dependent entries for that document are skipped.
8. Server-side nonce deduplication makes re-submission safe after crashes.

The client should not clear the local queue until the server confirms acceptance (`ChangeAccepted`).

## 10. Conflict Resolution

Automerge handles structural merge automatically (concurrent edits to different fields merge cleanly). However, application-level invariants may be violated after a CRDT merge. The sync engine runs **post-merge validation** to detect and correct these:

**Hierarchy cycle detection:** if concurrent edits to `parentGroupId` fields create a cycle in the group hierarchy, the validator breaks the cycle by setting one entity's parent to `null` (root). The correction is emitted as a new CRDT change and synced to all devices.

**Sort order repair:** if concurrent edits produce duplicate or non-contiguous sort orders within a collection, the validator renormalizes sort orders to restore a consistent sequence.

**Fronting session normalization:** concurrent edits that produce invalid fronting states (e.g., `endTime < startTime`) are corrected automatically.

**Timer config normalization:** waking-hours constraints are validated and corrected if concurrent edits produce impossible time ranges.

**Conflict notifications:** all auto-resolved conflicts generate ephemeral `ConflictNotification` records. These are not persisted to the CRDT document -- they are delivered to the client callback for UI display.

**Correction envelopes:** all corrections are submitted as new encrypted changes, so they become part of the document's CRDT history and propagate to all devices.

**Validator implementation:** `packages/sync/src/post-merge-validator.ts` runs each rule (`hierarchy`, `sort-order`, `fronting-sessions`, `fronting-comments`, `tombstones`, `check-in`, `friend-connection`, `m4-timer-config`, `m4-webhook-config`) after every merge. Tests are split per concern under `packages/sync/src/__tests__/post-merge-validator-*.test.ts` so each rule can evolve independently.

## 11. Error Codes

| Code                   | Recovery                                          |
| ---------------------- | ------------------------------------------------- |
| `AUTH_FAILED`          | Re-authenticate; refresh session token            |
| `AUTH_EXPIRED`         | Refresh session token, then reconnect             |
| `PERMISSION_DENIED`    | Do not retry; check access permissions            |
| `DOCUMENT_NOT_FOUND`   | Re-fetch manifest; document may have been removed |
| `DOCUMENT_LOAD_DENIED` | Do not retry; verify KeyGrant status              |
| `SNAPSHOT_NOT_FOUND`   | Fall back to full change replay                   |
| `VERSION_CONFLICT`     | Re-fetch latest snapshot; discard local snapshot  |
| `MALFORMED_MESSAGE`    | Fix message construction; do not retry unchanged  |
| `QUOTA_EXCEEDED`       | Surface to user; evict archived documents         |
| `RATE_LIMITED`         | Exponential backoff starting at 1 second          |
| `INVALID_ENVELOPE`     | Check signing key and envelope construction       |
| `PROTOCOL_MISMATCH`    | Upgrade client; do not retry                      |
| `INTERNAL_ERROR`       | Exponential backoff starting at 5 seconds         |
