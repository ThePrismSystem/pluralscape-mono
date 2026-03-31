# Partial Replication Strategy

## 1. Overview

This specification expands section 9 of the document topology, defining the rules by which each client type determines which documents to subscribe to. Partial replication allows clients to sync only the data they need, reducing storage consumption and initial sync time.

**Cross-references:**

- `document-topology.md` — document types, manifest structure, naming conventions
- `document-lifecycle.md` — archive/cold storage, sync priority ordering
- `protocol-messages.md` — how subscription rules map to protocol messages

Implementation is M3 scope. This document is the authoritative design input for that work.

---

## 2. Client Types and Replication Profiles

Three replication profiles exist, corresponding to the three distinct client access patterns:

### Owner (Full) — `owner-full`

Default profile for primary owner devices.

| Document Type    | Documents Synced                       |
| ---------------- | -------------------------------------- |
| `system-core`    | All (exactly one per system)           |
| `fronting`       | All periods (current + all historical) |
| `chat`           | All channels, all periods              |
| `journal`        | All periods                            |
| `note`           | All periods                            |
| `privacy-config` | All (exactly one per system)           |
| `bucket`         | All owned buckets                      |

### Owner (Lite) — `owner-lite`

For low-storage devices (e.g., Apple Watch, budget Android phones). Excludes historical data; defers journal and note to on-demand.

| Document Type    | Documents Synced                          |
| ---------------- | ----------------------------------------- |
| `system-core`    | All (exactly one per system)              |
| `fronting`       | Current period only                       |
| `chat`           | Active channels only, current period only |
| `journal`        | None by default (on-demand load only)     |
| `note`           | None by default (on-demand load only)     |
| `privacy-config` | All (exactly one per system)              |
| `bucket`         | All owned buckets                         |

**Active channel definition:** A channel is "active" if `updatedAt` is within the configurable `activeChannelWindowDays` (default 30 days) **OR** the channel is pinned (determined by the `channel.sortOrder` or a `pinned` flag in channel metadata).

### Friend — `friend`

For friend dashboard clients. Strict: no master-key documents.

| Document Type    | Documents Synced                                                 |
| ---------------- | ---------------------------------------------------------------- |
| `system-core`    | None                                                             |
| `fronting`       | None                                                             |
| `chat`           | None                                                             |
| `journal`        | None                                                             |
| `privacy-config` | None                                                             |
| `bucket`         | Only `bucket-{bucketId}` where friend has a non-revoked KeyGrant |

---

## 3. Subscription Filtering Algorithm

Subscription filtering is a pure function that maps a manifest to a subscription set:

```
filterManifest(manifest: SyncManifest, profile: ReplicationProfile) => SubscriptionSet
```

### Output

```typescript
interface SubscriptionSet {
  active: SyncManifestEntry[]; // documents to actively subscribe to
  available: SyncManifestEntry[]; // documents in manifest but not subscribed (available on-demand)
  evict: string[]; // docIds present locally but no longer in subscription
}
```

### Filtering Rules by Profile

**`owner-full`:**

- `active` = all manifest entries (no exclusions)
- `available` = empty
- `evict` = locally-stored docIds not in manifest (stale local docs)

**`owner-lite`:**

- `active` = entries matching:
  - `docType === "system-core"` (always)
  - `docType === "privacy-config"` (always)
  - `docType === "fronting"` AND is current time period (latest `timePeriod` by document type)
  - `docType === "chat"` AND `updatedAt >= now - activeChannelWindowDays * 86400000` AND is current time period
  - `docType === "bucket"` (always)
- `available` = manifest entries not in `active` (historical fronting, journal, note, inactive chat)
- `evict` = locally-stored docIds not in `active` (may evict historical docs on storage pressure)

**`friend`:**

- `active` = entries where `docType === "bucket"` AND friend has a non-revoked KeyGrant for that `bucketId`
- `available` = empty (friends cannot access non-bucket documents)
- `evict` = locally-stored docIds not in `active` (revoked grants)

### Server-Side vs Client-Side Filtering

| Profile      | Where Filtering Occurs | Why                                                                                           |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| `owner-full` | Client (trivially)     | Owner receives full manifest; all documents included                                          |
| `owner-lite` | Client                 | Owner receives full manifest; client applies lite filtering locally based on its preferences  |
| `friend`     | **Server**             | Server must filter the manifest before sending — friends must not see master-key doc metadata |

The server applies friend filtering at manifest fetch time using the friend's active KeyGrants.

---

## 4. Document Discovery and Manifest Lifecycle

### Manifest Fetch Triggers

The client fetches the manifest:

1. **Initial connection** — always fetch manifest on connect
2. **Server push** — server sends a `ManifestChanged` signal when the manifest is updated (e.g., new document added after a split, bucket document created)
3. **Reconnection** — always re-fetch on reconnect; may have missed signals
4. **Explicit request** — user triggers "refresh" in settings

### New Document Discovery

When a new document appears in the manifest (e.g., after a time-based split):

1. Server adds the new `SyncManifestEntry` to the manifest
2. Server sends `ManifestChanged` signal to all subscribed devices
3. Client re-fetches the manifest and computes the new `SubscriptionSet`
4. Client subscribes to the new document (if in active set)

### Archived Documents in the Manifest

- Archived documents remain in the manifest with `archived: true`
- `owner-full` profile skips archived entries during incremental sync (but can load on-demand)
- `owner-lite` profile skips all archived entries
- `friend` profile never sees archived documents (filtered by server)

---

## 5. Initial Sync (New Device)

### Sync Sequence

1. **Authenticate** — device authenticates with session token
2. **Fetch manifest** — receive filtered manifest
3. **Compute subscription set** — apply replication profile filter
4. **Sync in priority order** — per `SYNC_PRIORITY_ORDER` (document-lifecycle.md §6.3)
5. **Progressive UI loading** — core data (system, members) available immediately; chat/journal streams in

### Size Estimates (from document-topology.md §6)

| System Size          | Estimated Initial Sync |
| -------------------- | ---------------------- |
| Small (10 members)   | ~860 KB                |
| Medium (50 members)  | ~3.8 MB                |
| Large (500+ members) | ~23 MB+                |

These estimates assume `owner-full` profile with one year of data. `owner-lite` is significantly smaller.

---

## 6. Incremental Sync

### Per-Document Sequence Tracking

Each subscribed document has a `DocumentSyncState` tracking sync position:

```typescript
interface DocumentSyncState {
  docId: string;
  lastSyncedSeq: number; // highest seq applied locally
  lastSnapshotVersion: number; // snapshot version applied at bootstrap
  onDemand: boolean; // true if loaded on-demand (not persistent subscription)
}
```

### Real-Time Subscription

For each document in the active subscription set:

1. Call `SyncNetworkAdapter.subscribe(docId, onChanges)` — server pushes new changes as they arrive
2. On `onChanges` callback: decrypt and apply via `EncryptedSyncSession.applyEncryptedChanges`
3. Track `lastSyncedSeq` after each batch

### Fallback Recovery

If local state is detected as corrupted:

1. Re-fetch `fetchLatestSnapshot(docId)` — load from snapshot
2. Re-fetch `fetchChangesSince(docId, snapshot.snapshotVersion)` — apply changes since snapshot
3. Resume normal subscription

---

## 7. Sync Priority Ordering

When multiple documents need syncing (initial sync or catch-up), documents are processed in priority order. See `SYNC_PRIORITY_ORDER` in `document-lifecycle.md §6.3` for the ordered list.

**Priority rationale:**

1. `system-core` — member profiles and structure; needed to render anything
2. `privacy-config` — privacy rules; needed before any friend-facing features
3. `fronting` (current) — active fronting session; real-time feature
4. `chat` (active, current) — active conversations
5. `journal` — long-form writing; less time-sensitive
6. `bucket` — friend-facing projections; updated after source data
7. Historical data — loaded on-demand only

---

## 8. Friend Subscription Lifecycle

### Initial Grant

1. Owner creates a `KeyGrant` for friend's account in `privacy-config`
2. Owner writes the encrypted bucket projection to `bucket-{bucketId}`
3. Server adds `bucket-{bucketId}` to friend's filtered manifest
4. Friend receives `ManifestChanged` signal on next connection
5. Friend fetches updated manifest → discovers new bucket doc → syncs

### Revocation

1. Owner marks `keyGrants["kg_id"].revokedAt = timestamp`
2. Server removes `bucket-{bucketId}` from friend's filtered manifest
3. Server sends `ManifestChanged` signal to friend's devices
4. Friend's devices detect `bucket-{bucketId}` moved to `evict` set
5. Friend's client deletes local copy of `bucket-{bucketId}`
6. Owner rotates bucket key: new `BucketKey` generated, bucket doc re-encrypted, new `KeyGrant` issued to remaining friends

### New Grant (Existing Friend)

- New bucket added → appears in friend's next manifest fetch
- No reconnection required if `ManifestChanged` is delivered

---

## 9. On-Demand Document Loading

Non-subscribed documents (historical periods, lite-profile journal entries) can be loaded on-demand:

```typescript
interface OnDemandLoadRequest {
  docId: string;
  persist: boolean; // true = store locally; false = memory only
}
```

**On-demand flow:**

1. UI requests historical data (e.g., "Load older fronting history")
2. Client sends `DocumentLoadRequest` to server
3. Server performs access check (same rules as subscription)
4. Server returns snapshot + changes for requested document
5. Client decrypts and loads into memory (or persists if `persist: true`)
6. `onDemand: true` in `DocumentSyncState` — not part of active subscription, not synced automatically

---

## 10. Edge Cases

### Storage Exceeded During Initial Sync

If the client's storage budget is exceeded mid-sync:

1. Pause sync
2. Evict oldest archived documents first (in reverse priority order)
3. Never evict `system-core` or `privacy-config`
4. Resume sync from where paused
5. Notify user if budget is still exceeded after eviction

### Manifest/Local Divergence

If the local document set diverges from the manifest (e.g., stale local docs not in manifest):

1. Compute `evict` set from `filterManifest` output
2. Delete local documents in `evict` set
3. Subscribe to any documents in `active` set not yet synced locally

### Network Partition During Time-Split

If a network partition occurs during a time-based split:

1. Old document continues to receive writes from offline client
2. On reconnect: client discovers new time-period document in manifest
3. Client migrates active entities (e.g., active fronting sessions) to new document
4. Old document's offline writes are applied to the new document via CRDT merge
