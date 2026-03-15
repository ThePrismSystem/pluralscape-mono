# Sync Protocol Messages

## 1. Overview

This specification defines the wire protocol used between sync clients and the sync server. It is transport-agnostic: messages are the same whether transmitted over WebSocket, HTTP long-polling, or a future peer-to-peer channel.

**Cross-references:**

- `partial-replication.md` — subscription rules, replication profiles, manifest lifecycle
- `document-lifecycle.md` — compaction, time-splits, storage budget enforcement
- `document-topology.md` — document types and naming conventions

All binary fields (ciphertext, nonces, signatures, public keys) are serialized as Base64url strings in V1. The server is zero-knowledge — it never sees plaintext content.

---

## 2. Transport Abstraction

Implementations adapt a concrete transport to the `SyncTransport` interface:

```typescript
type TransportState = "connecting" | "connected" | "disconnecting" | "disconnected";

interface SyncTransport {
  readonly state: TransportState;
  send(message: ClientMessage): Promise<void>;
  onMessage(handler: (message: ServerMessage) => void): void;
  close(): void;
}
```

The transport is responsible only for delivery. All protocol logic (sequencing, retries, handshake) lives above the transport layer.

---

## 3. Message Types

All messages share a common base:

```typescript
interface SyncMessageBase {
  /** Identifies the message type. Discriminant for the union. */
  readonly type: string;
  /**
   * Client-generated UUID correlating a request with its response.
   * Server echoes the correlationId on all direct responses.
   * Push messages (DocumentUpdate, ManifestChanged) use null.
   */
  readonly correlationId: string | null;
}
```

### Client → Server Messages (9)

| Message Type            | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `AuthenticateRequest`   | Initiates the session; presents credentials                |
| `ManifestRequest`       | Requests the current filtered manifest                     |
| `SubscribeRequest`      | Subscribes to a set of documents with local sync positions |
| `UnsubscribeRequest`    | Cancels real-time subscription for a document              |
| `FetchSnapshotRequest`  | Requests the latest encrypted snapshot for a document      |
| `FetchChangesRequest`   | Requests changes since a given seq                         |
| `SubmitChangeRequest`   | Submits a new encrypted change envelope                    |
| `SubmitSnapshotRequest` | Submits a new encrypted snapshot (compaction)              |
| `DocumentLoadRequest`   | Requests a non-subscribed document (on-demand)             |

### Server → Client Messages (10)

| Message Type           | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `AuthenticateResponse` | Session established; returns session token              |
| `ManifestResponse`     | Returns the filtered manifest                           |
| `SubscribeResponse`    | Confirms subscriptions with catch-up data               |
| `DocumentUpdate`       | Real-time push of new changes for a subscribed document |
| `SnapshotResponse`     | Returns requested snapshot                              |
| `ChangesResponse`      | Returns requested changes since seq                     |
| `ChangeAccepted`       | Confirms server has accepted a submitted change         |
| `SnapshotAccepted`     | Confirms server has accepted a submitted snapshot       |
| `ManifestChanged`      | Push notification that the manifest has been updated    |
| `SyncError`            | Error response for any failed request                   |

---

## 4. Message Definitions

### 4.1 AuthenticateRequest

```typescript
interface AuthenticateRequest extends SyncMessageBase {
  readonly type: "AuthenticateRequest";
  /** Protocol version — must equal SYNC_PROTOCOL_VERSION (1). */
  readonly protocolVersion: number;
  /** Session token from the auth service. */
  readonly sessionToken: string;
  /** The system ID this client belongs to. */
  readonly systemId: string;
  /** Replication profile type the client intends to use. */
  readonly profileType: "owner-full" | "owner-lite" | "friend";
}
```

### 4.2 AuthenticateResponse

```typescript
interface AuthenticateResponse extends SyncMessageBase {
  readonly type: "AuthenticateResponse";
  /** Server-assigned sync session ID for this connection. */
  readonly syncSessionId: string;
  /** UTC milliseconds of server time (for client clock alignment). */
  readonly serverTime: number;
}
```

### 4.3 ManifestRequest

```typescript
interface ManifestRequest extends SyncMessageBase {
  readonly type: "ManifestRequest";
  readonly systemId: string;
}
```

### 4.4 ManifestResponse

```typescript
interface ManifestResponse extends SyncMessageBase {
  readonly type: "ManifestResponse";
  readonly manifest: SyncManifest;
}
```

### 4.5 SubscribeRequest

```typescript
interface SubscribeRequest extends SyncMessageBase {
  readonly type: "SubscribeRequest";
  /**
   * Per-document sync positions the client already holds locally.
   * Server uses these to compute catch-up changes.
   */
  readonly documents: readonly DocumentVersionEntry[];
}

interface DocumentVersionEntry {
  readonly docId: string;
  /** Highest seq the client has applied. 0 = no changes yet. */
  readonly lastSyncedSeq: number;
  /** Snapshot version the client bootstrapped from. 0 = no snapshot. */
  readonly lastSnapshotVersion: number;
}
```

### 4.6 SubscribeResponse

```typescript
interface SubscribeResponse extends SyncMessageBase {
  readonly type: "SubscribeResponse";
  /**
   * Per-document catch-up data. Entry is omitted for documents where
   * the client is already current (no missing changes, no newer snapshot).
   */
  readonly catchup: readonly DocumentCatchup[];
}

interface DocumentCatchup {
  readonly docId: string;
  /** Changes since the client's lastSyncedSeq (in ascending seq order). */
  readonly changes: readonly EncryptedChangeEnvelope[];
  /**
   * Present only if the server has a newer snapshot than the client's
   * lastSnapshotVersion. Client should bootstrap from snapshot then apply changes.
   */
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}
```

### 4.7 UnsubscribeRequest

```typescript
interface UnsubscribeRequest extends SyncMessageBase {
  readonly type: "UnsubscribeRequest";
  readonly docId: string;
}
```

No response is sent for unsubscription (fire-and-forget after confirmation).

### 4.8 FetchSnapshotRequest / SnapshotResponse

```typescript
interface FetchSnapshotRequest extends SyncMessageBase {
  readonly type: "FetchSnapshotRequest";
  readonly docId: string;
}

interface SnapshotResponse extends SyncMessageBase {
  readonly type: "SnapshotResponse";
  readonly docId: string;
  /** Null if no snapshot exists yet for this document. */
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}
```

### 4.9 FetchChangesRequest / ChangesResponse

```typescript
interface FetchChangesRequest extends SyncMessageBase {
  readonly type: "FetchChangesRequest";
  readonly docId: string;
  /** Return changes with seq > sinceSeq. */
  readonly sinceSeq: number;
}

interface ChangesResponse extends SyncMessageBase {
  readonly type: "ChangesResponse";
  readonly docId: string;
  readonly changes: readonly EncryptedChangeEnvelope[];
}
```

### 4.10 SubmitChangeRequest / ChangeAccepted

```typescript
interface SubmitChangeRequest extends SyncMessageBase {
  readonly type: "SubmitChangeRequest";
  readonly docId: string;
  /** Change envelope without seq — server assigns the seq on acceptance. */
  readonly change: Omit<EncryptedChangeEnvelope, "seq">;
}

interface ChangeAccepted extends SyncMessageBase {
  readonly type: "ChangeAccepted";
  readonly docId: string;
  /** Server-assigned seq for the accepted change. */
  readonly assignedSeq: number;
}
```

### 4.11 SubmitSnapshotRequest / SnapshotAccepted

```typescript
interface SubmitSnapshotRequest extends SyncMessageBase {
  readonly type: "SubmitSnapshotRequest";
  readonly docId: string;
  readonly snapshot: EncryptedSnapshotEnvelope;
}

interface SnapshotAccepted extends SyncMessageBase {
  readonly type: "SnapshotAccepted";
  readonly docId: string;
  readonly snapshotVersion: number;
}
```

### 4.12 DocumentLoadRequest

```typescript
interface DocumentLoadRequest extends SyncMessageBase {
  readonly type: "DocumentLoadRequest";
  readonly documentId: string;
  /**
   * Whether the client intends to persist this document locally.
   * Informational — does not affect server behavior.
   */
  readonly persist: boolean;
}
```

Server responds with `SnapshotResponse` + `ChangesResponse` for the requested document, or `SyncError` if access is denied.

### 4.13 DocumentUpdate (server push)

```typescript
interface DocumentUpdate extends SyncMessageBase {
  readonly type: "DocumentUpdate";
  /** correlationId is null — this is a server-initiated push. */
  readonly correlationId: null;
  readonly docId: string;
  /** One or more new changes, in ascending seq order. */
  readonly changes: readonly EncryptedChangeEnvelope[];
}
```

### 4.14 ManifestChanged (server push)

```typescript
interface ManifestChanged extends SyncMessageBase {
  readonly type: "ManifestChanged";
  readonly correlationId: null;
  readonly systemId: string;
  /**
   * Informational summary of what changed (e.g., new docId).
   * Client MUST re-fetch the full manifest to get accurate state.
   */
  readonly hint: string | null;
}
```

### 4.15 SyncError

```typescript
interface SyncError extends SyncMessageBase {
  readonly type: "SyncError";
  readonly code: SyncErrorCode;
  readonly message: string;
  /** Present if the error is scoped to a specific document. */
  readonly docId: string | null;
}
```

---

## 5. Message Serialization

**V1 format: JSON over WebSocket frames or HTTP request/response bodies.**

- Binary fields (`ciphertext`, `nonce`, `signature`, `authorPublicKey`) are encoded as Base64url strings.
- One complete message per WebSocket frame or HTTP body.
- Maximum message size: 5 MB (enforced by server; larger payloads are rejected with `MALFORMED_MESSAGE`).

**Future:** MessagePack or CBOR for bandwidth reduction, with negotiation in `AuthenticateRequest`.

---

## 6. Handshake Flow

```
Client                           Server
  │                                │
  │── AuthenticateRequest ─────────▶│  present session token
  │◀─ AuthenticateResponse ─────────│  syncSessionId issued
  │                                │
  │── ManifestRequest ─────────────▶│  request filtered manifest
  │◀─ ManifestResponse ─────────────│  receive filtered manifest
  │                                │
  │── SubscribeRequest ────────────▶│  declare local sync positions
  │◀─ SubscribeResponse ────────────│  receive catch-up data per doc
  │                                │
  │         ─── steady state ───   │
  │◀─ DocumentUpdate ───────────────│  server pushes new changes
  │── SubmitChangeRequest ──────────▶│  client submits change
  │◀─ ChangeAccepted ───────────────│  server confirms with seq
  │◀─ ManifestChanged ──────────────│  manifest updated (new doc, grant)
  │── ManifestRequest ─────────────▶│  re-fetch manifest
  │◀─ ManifestResponse ─────────────│  updated manifest
```

**Ordering requirements:**

1. `AuthenticateRequest` MUST be the first message. Any other message before authentication results in a `SyncError { code: "AUTH_FAILED" }` and connection close.
2. `ManifestRequest` MUST precede `SubscribeRequest`.
3. After the handshake, client and server exchange messages concurrently — there is no strict turn-taking.

---

## 7. Steady-State Sync

### Change submission cycle

```
Client                           Server                       Other clients
  │── SubmitChangeRequest ────────▶│                              │
  │◀─ ChangeAccepted (seq=N) ──────│                              │
  │                                │── DocumentUpdate (seq=N) ───▶│
```

1. Client calls `submitChange(docId, change)`.
2. Server validates the envelope signature, assigns `seq=N` (monotonically increasing per document), stores the ciphertext.
3. Server sends `ChangeAccepted { assignedSeq: N }` back to the submitting client.
4. Server broadcasts `DocumentUpdate { changes: [envelope with seq=N] }` to all other clients subscribed to that document.

### Compaction submission

```
Client                           Server
  │── SubmitSnapshotRequest ──────▶│
  │◀─ SnapshotAccepted ────────────│  server prunes changes ≤ snapshotVersion
```

If a concurrent snapshot is submitted (two devices compact simultaneously), the server accepts the highest `snapshotVersion` and rejects the lower with `VERSION_CONFLICT`.

---

## 8. Error Types

```typescript
type SyncErrorCode =
  | "AUTH_FAILED" // Bad or missing session token
  | "AUTH_EXPIRED" // Session token has expired; re-authenticate
  | "PERMISSION_DENIED" // Access to document or system not granted
  | "DOCUMENT_NOT_FOUND" // Requested docId not in manifest
  | "VERSION_CONFLICT" // SnapshotVersion not strictly increasing
  | "MALFORMED_MESSAGE" // Message failed schema validation or size limit
  | "QUOTA_EXCEEDED" // Storage budget exceeded (see document-lifecycle.md §6)
  | "RATE_LIMITED" // Submitting changes too rapidly
  | "PROTOCOL_MISMATCH" // Client protocolVersion != SYNC_PROTOCOL_VERSION
  | "INTERNAL_ERROR"; // Server-side error; retry after backoff
```

### Recovery strategies per error code

| Code                 | Recovery                                                              |
| -------------------- | --------------------------------------------------------------------- |
| `AUTH_FAILED`        | Re-authenticate from scratch; refresh session token from auth service |
| `AUTH_EXPIRED`       | Refresh session token, then reconnect                                 |
| `PERMISSION_DENIED`  | Do not retry; surface to user if unexpected                           |
| `DOCUMENT_NOT_FOUND` | Re-fetch manifest; document may have been removed                     |
| `VERSION_CONFLICT`   | Re-fetch latest snapshot; discard conflicting local snapshot          |
| `MALFORMED_MESSAGE`  | Inspect message construction; do not retry unchanged                  |
| `QUOTA_EXCEEDED`     | Surface to user; evict archived documents, then retry                 |
| `RATE_LIMITED`       | Exponential backoff starting at 1 second                              |
| `PROTOCOL_MISMATCH`  | Upgrade client; do not retry                                          |
| `INTERNAL_ERROR`     | Exponential backoff starting at 5 seconds                             |

---

## 9. Idempotency Guarantees

| Message                 | Idempotent?     | Notes                                                                              |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------- |
| `AuthenticateRequest`   | Yes             | Re-authenticating on same session token refreshes it                               |
| `ManifestRequest`       | Yes             | Read-only; safe to repeat                                                          |
| `SubscribeRequest`      | Yes             | Re-subscribing is a no-op if already subscribed; catch-up re-delivered             |
| `UnsubscribeRequest`    | Yes             | Unsubscribing a non-subscribed doc is a no-op                                      |
| `FetchSnapshotRequest`  | Yes             | Read-only                                                                          |
| `FetchChangesRequest`   | Yes             | Read-only                                                                          |
| `SubmitChangeRequest`   | **Conditional** | Server deduplicates by `(docId, authorPublicKey, nonce)` — same nonce = idempotent |
| `SubmitSnapshotRequest` | **Conditional** | Server accepts only if `snapshotVersion` is strictly higher than current           |
| `DocumentLoadRequest`   | Yes             | Read-only; server access check is stateless                                        |

---

## 10. Reconnection Protocol

When a connection drops, the client follows this sequence:

1. **Detect disconnect** — transport state transitions to `"disconnected"`.
2. **Backoff** — exponential backoff (1 s, 2 s, 4 s, … max 60 s).
3. **Re-authenticate** — send `AuthenticateRequest` with existing session token. If `AUTH_EXPIRED`, refresh from auth service first.
4. **Re-fetch manifest** — send `ManifestRequest`. Manifest may have changed while offline.
5. **Re-compute subscription set** — apply replication profile to updated manifest.
6. **Re-subscribe with local seq** — send `SubscribeRequest` with current `lastSyncedSeq` per document. Server sends only the changes the client missed.
7. **Flush offline queue** — submit any `SubmitChangeRequest` messages queued while offline, in the order they were created.

**Offline change queue:** The client MUST queue `SubmitChangeRequest` messages locally when disconnected and submit them in order on reconnect. The nonce-based deduplication on `SubmitChangeRequest` makes retransmission safe.

---

## 11. Transport Notes (Informative)

**WebSocket (primary):**

- Full-duplex; supports server push (`DocumentUpdate`, `ManifestChanged`).
- One WebSocket connection per client device.
- Ping/pong heartbeat every 30 s to detect silent disconnects.

**HTTP long-polling (fallback):**

- Client polls `GET /sync/poll?since=<lastEventId>` for server-pushed messages.
- Client posts `POST /sync/message` for client-sent messages.
- Server-sent events are delivered as a newline-delimited JSON stream.
- No persistent connection required; compatible with strict corporate proxies.

**Peer-to-peer (future):**

- Same message format applies.
- Transport would be WebRTC data channels or libp2p streams.
- No server involvement for change propagation — `ChangeAccepted` is not applicable.
- Sequence numbering would be replaced by Automerge's built-in vector clock.

---

## 12. Protocol Version

`SYNC_PROTOCOL_VERSION = 1`

The version integer is declared in `AuthenticateRequest.protocolVersion`. If the server does not support the client's version, it responds with `SyncError { code: "PROTOCOL_MISMATCH" }` and closes the connection.

Version bumps are required for:

- Any breaking change to message field names or types
- Any change to serialization format
- Any change to handshake ordering requirements

Backwards-compatible additions (new optional fields, new error codes) do not require a version bump.

---

## 13. Adapter Mapping

The `SyncNetworkAdapter` interface (from `adapters/network-adapter.ts`) maps to protocol messages as follows:

| Adapter Method                       | Protocol Messages                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `submitChange(docId, change)`        | `SubmitChangeRequest` → `ChangeAccepted` (returns envelope with `assignedSeq`)                    |
| `fetchChangesSince(docId, sinceSeq)` | `FetchChangesRequest` → `ChangesResponse`                                                         |
| `submitSnapshot(docId, snapshot)`    | `SubmitSnapshotRequest` → `SnapshotAccepted`                                                      |
| `fetchLatestSnapshot(docId)`         | `FetchSnapshotRequest` → `SnapshotResponse`                                                       |
| `subscribe(docId, onChanges)`        | Handled by `SubscribeRequest` at handshake; `DocumentUpdate` pushed by server during steady state |
| `fetchManifest(systemId)`            | `ManifestRequest` → `ManifestResponse`; also triggered by `ManifestChanged` push                  |

The `EncryptedRelay` (used in tests) implements `SyncNetworkAdapter` without using the protocol — it is an in-memory shortcut for unit testing that bypasses the transport entirely.
