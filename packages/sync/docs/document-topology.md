# Document Topology Specification

## 1. Overview

This specification defines how Pluralscape's domain entities map to Automerge CRDT documents for offline-first sync. Each document represents a unit of collaboration bounded by encryption key assignment, access pattern, and growth characteristics.

The topology balances three constraints:

1. **Encryption boundaries** — data encrypted with different keys must live in separate documents
2. **Access patterns** — data accessed together should sync together
3. **Growth management** — unbounded append-only data must be splittable to avoid oversized documents

## 2. Design Principles

- **Encryption key = document boundary.** All entities within a document share the same encryption key. Master-key entities and per-bucket entities never coexist in one document.
- **Minimize sync overhead.** Fewer documents means fewer sync handshakes. Per-entity documents (one per member, one per message) would create thousands of documents with high sync overhead. Per-system (one monolithic document) forces syncing everything on every change.
- **Separate by mutation frequency.** High-frequency append-only data (fronting, chat) is separated from low-frequency LWW data (member profiles, settings) to avoid unnecessary syncs.
- **Time-based splitting for unbounded growth.** Documents that grow indefinitely (fronting, chat) split by time period when they exceed size thresholds.
- **Write-time fan-out for bucket projections.** E2E encryption prevents server-side projection. The owner client writes filtered copies to per-bucket documents at mutation time.
- **Manifest-based discovery.** Clients discover available documents through a server-maintained plaintext manifest, not by enumerating Automerge documents directly.

## 3. Document Types

### 3.1 `system-core`

**Encryption key:** Master key
**Naming:** `system-core-{systemId}`
**CRDT strategy:** LWW (last-writer-wins) per field, ordered lists for collections

Contains the structural definition of a system — entities that are bounded by system size and mutated infrequently relative to operational data.

**Entities:**

| Entity           | CRDT Type              | Notes                                     |
| ---------------- | ---------------------- | ----------------------------------------- |
| Member           | LWW map                | name, pronouns, description, colors, etc. |
| MemberPhoto      | LWW map                | photo reference metadata                  |
| Group            | LWW map + ordered list | group hierarchy via parentGroupId         |
| Subsystem        | LWW map                | nested via parentSubsystemId              |
| Relationship     | LWW map                | links between members                     |
| CustomFront      | LWW map                | abstract cognitive states                 |
| FieldDefinition  | LWW map                | custom field schemas                      |
| FieldValue       | LWW map                | per-member custom field values            |
| SystemSettings   | LWW map                | system-wide configuration                 |
| SideSystem       | LWW map                | linked side systems                       |
| Layer            | LWW map                | visual/organizational layers              |
| InnerWorldEntity | LWW map                | innerworld entities                       |
| InnerWorldRegion | LWW map                | innerworld regions                        |
| Timer            | LWW map                | reminder/countdown timers                 |

**Growth pattern:** Bounded by entity count. Even polyfragmented systems (500+ members) produce a document well within Automerge's efficient range.

**Conflict resolution:** LWW per field. Two devices editing the same member's name concurrently: last write wins based on Automerge's causal ordering. Structural changes (adding/removing members) are conflict-free list operations.

### 3.2 `fronting`

**Encryption key:** Master key
**Naming:** `fronting-{systemId}` (splits to `fronting-{systemId}-{YYYY-QN}`)
**CRDT strategy:** Append-only list for sessions/switches, LWW for session end times

Contains all fronting activity — the highest-frequency write path in the application.

**Entities:**

| Entity          | CRDT Type    | Notes                                               |
| --------------- | ------------ | --------------------------------------------------- |
| FrontingSession | Append + LWW | created on switch-in, endTime updated on switch-out |
| Switch          | Append-only  | immutable switch events                             |
| CheckInRecord   | Append-only  | periodic check-in snapshots                         |

**Growth pattern:** Append-only, unbounded. A system averaging 5 switches/day produces ~1,825 entries/year. High-frequency systems may produce 20+/day.

**Time-based splitting:** When the document exceeds 5 MB, split by calendar quarter. Historical quarters become read-only (no new appends). The current quarter's document is the active write target. Naming convention: `fronting-{systemId}-2026-Q1`.

### 3.3 `chat-{channelId}`

**Encryption key:** Master key
**Naming:** `chat-{channelId}` (splits to `chat-{channelId}-{YYYY-MM}`)
**CRDT strategy:** Append-only list for messages, LWW for channel metadata

Each chat channel gets its own document, preventing a monolithic chat document and enabling per-channel sync granularity.

**Entities:**

| Entity             | CRDT Type   | Notes                                                              |
| ------------------ | ----------- | ------------------------------------------------------------------ |
| Channel (metadata) | LWW map     | name, description, settings                                        |
| Message            | Append-only | immutable once sent; edits are new entries with `editOf` reference |
| BoardMessage       | Append-only | pinned/board messages                                              |
| Poll               | LWW map     | poll metadata (question, options)                                  |
| PollOption         | LWW map     | options within a poll                                              |
| PollVote           | Append-only | votes are immutable                                                |
| Acknowledgement    | Append-only | message acknowledgements                                           |

**Growth pattern:** Append-only per channel, unbounded. Active channels may produce 50-100 messages/day.

**Time-based splitting:** When a channel document exceeds 5 MB, split by calendar month. Historical months become read-only. Naming: `chat-{channelId}-2026-03`. Channel metadata lives in the current (active) month's document.

### 3.4 `journal`

**Encryption key:** Master key
**Naming:** `journal-{systemId}`
**CRDT strategy:** Append-only for entries, LWW for entry content, ordered list for wiki pages

Contains long-form writing — journal entries and wiki/notes content.

**Entities:**

| Entity       | CRDT Type    | Notes                               |
| ------------ | ------------ | ----------------------------------- |
| JournalEntry | Append + LWW | created once, content may be edited |
| WikiPage     | LWW map      | collaboratively editable pages      |
| Note         | LWW map      | short-form notes                    |

**Growth pattern:** Append-only with potentially large individual entries. A system writing 500-word entries daily produces ~180 KB/year of raw text. Rich text with formatting metadata is larger.

**Splitting:** Not time-split by default. If a journal document exceeds 10 MB, consider splitting by year. Most systems will not reach this threshold.

### 3.5 `privacy-config`

**Encryption key:** Master key
**Naming:** `privacy-config-{systemId}`
**CRDT strategy:** LWW maps, append-only for immutable grants

Contains all privacy configuration — bucket definitions, content tags, friend connections, and key grants. Separated from `system-core` because privacy configuration has different access patterns and is the control plane for bucket document fan-out.

**Entities:**

| Entity           | CRDT Type    | Notes                        |
| ---------------- | ------------ | ---------------------------- |
| PrivacyBucket    | LWW map      | bucket definitions           |
| BucketContentTag | LWW map      | entity-to-bucket assignments |
| FriendConnection | LWW map      | friend relationship state    |
| FriendCode       | LWW map      | immutable friend codes       |
| KeyGrant         | Append + LWW | key grants with revocation   |

**Growth pattern:** Low-frequency mutations. Typical systems have 1-5 buckets, 0-50 friends.

### 3.6 `bucket-{bucketId}`

**Encryption key:** Per-bucket key (BucketKey)
**Naming:** `bucket-{bucketId}`
**CRDT strategy:** LWW maps (projections of source entities)

Bucket documents contain **projections** — filtered, re-encrypted copies of entities from source documents (system-core, fronting, etc.) that are visible within a given bucket's scope. This is necessary because E2E encryption prevents the server from performing access-control filtering.

**Contents:** Projections of entities whose `BucketContentTag` assignments include this bucket, filtered by the bucket's `BucketVisibilityScope` settings:

| Scope             | Projected From                | Source Document  |
| ----------------- | ----------------------------- | ---------------- |
| `members`         | Member (filtered fields)      | system-core      |
| `custom-fields`   | FieldDefinition, FieldValue   | system-core      |
| `fronting-status` | FrontingSession (active only) | fronting         |
| `custom-fronts`   | CustomFront                   | system-core      |
| `notes`           | Note                          | journal          |
| `chat`            | Channel, Message              | chat-{channelId} |
| `journal-entries` | JournalEntry                  | journal          |
| `member-photos`   | MemberPhoto                   | system-core      |
| `groups`          | Group                         | system-core      |

**Write-time fan-out:** When a source entity is created or updated, the owner client:

1. Looks up which buckets the entity is tagged with (via BucketContentTag)
2. For each bucket: encrypts a projection of the entity with the BucketKey and writes it to `bucket-{bucketId}`

This is O(buckets) per entity mutation. For typical systems with 1-3 buckets, this is negligible.

**Growth pattern:** Mirrors the growth of source data, filtered. Bucket documents are generally much smaller than their source documents.

## 4. Entity-to-Document Mapping Table

Every entity type from `packages/types/src/ids.ts` is listed below with its document assignment.

### Synced Entities

| Entity Type           | Document             | Key Type | CRDT Strategy                                                   |
| --------------------- | -------------------- | -------- | --------------------------------------------------------------- |
| `system`              | `system-core`        | Master   | LWW map                                                         |
| `member`              | `system-core`        | Master   | LWW map                                                         |
| `member-photo`        | `system-core`        | Master   | LWW map                                                         |
| `group`               | `system-core`        | Master   | LWW map + ordered list                                          |
| `subsystem`           | `system-core`        | Master   | LWW map                                                         |
| `relationship`        | `system-core`        | Master   | LWW map                                                         |
| `custom-front`        | `system-core`        | Master   | LWW map                                                         |
| `field-definition`    | `system-core`        | Master   | LWW map                                                         |
| `field-value`         | `system-core`        | Master   | LWW map                                                         |
| `system-settings`     | `system-core`        | Master   | LWW map                                                         |
| `side-system`         | `system-core`        | Master   | LWW map                                                         |
| `layer`               | `system-core`        | Master   | LWW map                                                         |
| `innerworld-entity`   | `system-core`        | Master   | LWW map                                                         |
| `innerworld-region`   | `system-core`        | Master   | LWW map                                                         |
| `timer`               | `system-core`        | Master   | LWW map                                                         |
| `fronting-session`    | `fronting`           | Master   | Append + LWW                                                    |
| `switch`              | `fronting`           | Master   | Append-only                                                     |
| `check-in-record`     | `fronting`           | Master   | Append-only                                                     |
| `channel`             | `chat-{channelId}`   | Master   | LWW map                                                         |
| `message`             | `chat-{channelId}`   | Master   | Append-only                                                     |
| `board-message`       | `chat-{channelId}`   | Master   | Append-only                                                     |
| `poll`                | `chat-{channelId}`   | Master   | LWW map                                                         |
| `poll-option`         | `chat-{channelId}`   | Master   | LWW map                                                         |
| `poll-vote`           | `chat-{channelId}`   | Master   | Append-only                                                     |
| `acknowledgement`     | `chat-{channelId}`   | Master   | Append-only                                                     |
| `journal-entry`       | `journal`            | Master   | Append + LWW                                                    |
| `wiki-page`           | `journal`            | Master   | LWW map                                                         |
| `note`                | `journal`            | Master   | LWW map                                                         |
| `blob`                | `journal` (ref only) | Master   | LWW map (metadata only — binary stored in S3/MinIO per ADR 009) |
| `bucket` (definition) | `privacy-config`     | Master   | LWW map                                                         |
| `friend-connection`   | `privacy-config`     | Master   | LWW map                                                         |
| `friend-code`         | `privacy-config`     | Master   | LWW map                                                         |
| `key-grant`           | `privacy-config`     | Master   | Append + LWW                                                    |

Blob metadata (MIME type, size, encryption info) lives in the `journal` document as a synced LWW map entry. The actual binary content is stored externally in S3/MinIO (see ADR 009). `BlobId` references appear as foreign keys across multiple documents: `system-core` (member photos), `chat-{channelId}` (message attachments), and `journal` (entry attachments).

### Not Synced (Server-Only)

These entities exist only on the server and are not part of CRDT sync:

| Entity Type               | Reason                                          |
| ------------------------- | ----------------------------------------------- |
| `account`                 | Server-side authentication state                |
| `auth-key`                | Server-side authentication credential           |
| `session`                 | Server-side session management                  |
| `api-key`                 | Server-side API access control                  |
| `webhook`                 | Server-side webhook configuration               |
| `event`                   | Server-side event log                           |
| `audit-log-entry`         | Server-side audit trail                         |
| `device-token`            | Push notification registration (server-managed) |
| `notification-config`     | Server-side notification preferences            |
| `recovery-key`            | Server-stored encrypted recovery material       |
| `device-transfer-request` | Server-mediated key transfer flow               |

### Sync Infrastructure (Meta)

These entity types are part of the sync machinery itself and are not stored as Automerge document content:

| Entity Type       | Role                                         |
| ----------------- | -------------------------------------------- |
| `sync-document`   | Tracks sync document metadata (the manifest) |
| `sync-queue-item` | Local sync queue for pending changes         |
| `sync-conflict`   | Conflict records for manual resolution       |

## 5. Encryption Key Assignment

Key assignments follow the two-tier model from ADR 006:

| Key Type           | Documents                                                                  | Distribution                                                                                                            |
| ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Master Key**     | `system-core`, `fronting`, `chat-{channelId}`, `journal`, `privacy-config` | Derived from password via Argon2id. Available on all owner devices. Never shared.                                       |
| **Per-Bucket Key** | `bucket-{bucketId}`                                                        | Random 256-bit symmetric key. Distributed to friends via asymmetric `crypto_box` (KeyGrant). Rotated on friend removal. |

**Key-document invariant:** Every entity within a single Automerge document is encrypted with exactly one key. This is enforced by the document topology — master-key entities and bucket-key entities never share a document.

**Encryption at the CRDT layer:** Following the secsync pattern, each Automerge change (or snapshot) is encrypted before transmission. The server stores and relays encrypted CRDT operations. Decryption and CRDT merge happen client-side.

## 6. Size Projections

### Methodology

Estimates assume:

- Member record: ~500 bytes (name, pronouns, description, colors, avatar ref, metadata)
- Fronting session: ~100 bytes (timestamps, member ref, type, optional comment)
- Chat message: ~500 bytes average (text content + metadata)
- Journal entry: ~2 KB average (rich text content)
- CRDT overhead: ~2x raw data size (Automerge operation history, actor IDs, timestamps)
- Encryption overhead: ~50 bytes per encrypted block (nonce + tag + algorithm metadata)

### Projections

| Document                     | Small System (10 members) | Medium System (50 members) | Large System (500+ members) |
| ---------------------------- | ------------------------- | -------------------------- | --------------------------- |
| `system-core`                | ~50 KB                    | ~250 KB                    | ~2.5 MB                     |
| `fronting` (1 year)          | ~200 KB                   | ~1 MB                      | ~10 MB                      |
| `chat` (per channel, 1 year) | ~500 KB                   | ~2 MB                      | ~5 MB                       |
| `journal` (1 year)           | ~100 KB                   | ~500 KB                    | ~5 MB                       |
| `privacy-config`             | ~10 KB                    | ~50 KB                     | ~200 KB                     |
| `bucket` (per bucket)        | ~20 KB                    | ~100 KB                    | ~1 MB                       |

**Automerge capacity:** Automerge 3.0 handles documents up to ~50 MB efficiently (10x memory reduction over 2.x). Even the largest projections (10 MB fronting for polyfragmented systems after one year) are well within this range. Time-based splitting provides a safety valve before documents approach this limit.

**Compaction impact:** Snapshots compress the operation history. A document with 1,000 changes compacts to a snapshot (~60-70% size reduction) plus only the changes since the last snapshot.

## 7. Document Lifecycle

### 7.1 Creation Triggers

| Document            | Created When                                 |
| ------------------- | -------------------------------------------- |
| `system-core`       | System account is created (first-time setup) |
| `fronting`          | System account is created                    |
| `chat-{channelId}`  | A new chat channel is created                |
| `journal`           | System account is created                    |
| `privacy-config`    | System account is created                    |
| `bucket-{bucketId}` | A new privacy bucket is created              |

All documents except `chat-{channelId}` and `bucket-{bucketId}` are created as part of system initialization. Channel and bucket documents are created on-demand.

### 7.2 Compaction / Snapshots

Following the secsync pattern:

- **Snapshot frequency:** Every 200-500 changes, the client creates a snapshot (full document state) and encrypts it
- **Change accumulation:** Between snapshots, individual changes (deltas) are encrypted and sent as updates
- **New device sync:** Downloads the latest snapshot + all changes since that snapshot, rather than replaying full history
- **Snapshot triggers:**
  - Change count exceeds 200 since last snapshot
  - Document size exceeds 1 MB since last snapshot
  - Explicit user-triggered sync (e.g., before logout)

### 7.3 Time-Based Splitting

When a document exceeds the size threshold, it splits by time period:

| Document           | Split Unit | Threshold | Naming Convention             |
| ------------------ | ---------- | --------- | ----------------------------- |
| `fronting`         | Quarter    | 5 MB      | `fronting-{systemId}-2026-Q1` |
| `chat-{channelId}` | Month      | 5 MB      | `chat-{channelId}-2026-03`    |
| `journal`          | Year       | 10 MB     | `journal-{systemId}-2026`     |

**Split mechanics:**

1. Client detects the active document exceeds the size threshold
2. Client creates a new document for the current time period
3. New writes go to the new document; the old document becomes read-only
4. The manifest is updated to reflect the split
5. Historical documents remain synced but receive no new writes

**Querying across splits:** The client merges results from multiple time-period documents when displaying historical data (e.g., fronting history across quarters).

### 7.4 Archival

Cold documents (no writes for 90+ days) can be marked as archived in the manifest:

- Archived documents are not actively synced on every connection
- Clients can request archived documents on-demand (e.g., viewing old chat history)
- Archival is reversible — writing to an archived document un-archives it
- The server retains archived documents indefinitely (non-destructive data principle)

### 7.5 Garbage Collection

Pluralscape follows a non-destructive data philosophy. True deletion is rare:

- **Soft delete:** Entities are marked `archived: true` — they remain in the CRDT document but are hidden from the UI
- **CRDT tombstones:** Automerge naturally handles deleted map keys/list entries with tombstones
- **Tombstone compaction:** Snapshots include the current state without individual tombstone entries, effectively GC'ing old deletions
- **Account deletion:** GDPR/right-to-erasure: the server deletes all encrypted documents and the manifest. Since the server holds only ciphertext, this is a clean wipe.

## 8. Document Discovery (Manifest)

The server maintains a per-system **manifest** — a plaintext metadata index of all documents belonging to a system.

### Manifest Structure

```
Manifest (per system):
  documents[]:
    - docId: string          # unique document identifier
    - docType: string        # "system-core" | "fronting" | "chat" | "journal" | "privacy-config" | "bucket"
    - keyType: "master" | "bucket"
    - bucketId?: string      # present for bucket docs
    - channelId?: string     # present for chat docs
    - timePeriod?: string    # present for time-split docs (e.g., "2026-Q1")
    - createdAt: timestamp
    - updatedAt: timestamp   # last change received
    - sizeBytes: number      # approximate current size
    - snapshotVersion: number
    - archived: boolean
```

### Access Patterns

| Client             | Manifest View                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Owner (any device) | Full manifest — all documents                                                                              |
| Friend             | Filtered manifest — only `bucket-{bucketId}` entries where the friend has an active (non-revoked) KeyGrant |

The manifest is **not** an Automerge document. It is server-maintained plaintext metadata. This is acceptable because:

- It contains no sensitive content (only document IDs, types, timestamps, sizes)
- It needs to be queryable by the server for friend access filtering
- It is derived from the state of actual Automerge documents, not a source of truth

### Sync Flow

1. Client connects and requests manifest
2. Server returns manifest (filtered by access level)
3. Client compares manifest against local state to identify documents needing sync
4. Client requests sync for outdated documents (latest snapshot + changes since)
5. Client decrypts and merges CRDT state locally

## 9. Partial Replication Profiles

| Client Profile   | Documents Synced                                                                                  | Notes                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Owner (full)** | All documents                                                                                     | Default for primary devices                                   |
| **Owner (lite)** | `system-core`, `fronting` (current quarter), `privacy-config`, active `chat-{channelId}` channels | For low-storage devices; excludes journal and historical data |
| **Friend**       | Only `bucket-{bucketId}` docs with active KeyGrant                                                | Friends never see master-key documents                        |

**Owner devices** always sync all master-key documents. The "lite" profile is an optimization for devices with limited storage — it defers historical fronting and inactive chat channels but can request them on-demand.

**Friend sync** is strictly limited to bucket projection documents. A friend's client:

1. Requests their filtered manifest (shows only granted bucket docs)
2. Downloads and decrypts only those bucket documents using their granted BucketKey
3. Has no visibility into master-key document existence

## 10. Edge Cases

### 10.1 Polyfragmented Systems (500+ Members)

`system-core` at ~2.5 MB is within Automerge's efficient range. If a system exceeds 1,000 members and the document approaches 10 MB, consider splitting `system-core` into `system-core-members` and `system-core-structure` (both master-key, same access pattern). This split is deferred until evidence shows it's needed.

### 10.2 Bucket Key Rotation

When a friend is removed from a bucket:

1. Generate new BucketKey
2. Re-encrypt all content in `bucket-{bucketId}` with new key
3. Issue new KeyGrants to remaining friends
4. Old document version with old key is replaced (not appended)

The re-encryption is O(bucket document size). Keeping bucket documents as projections (not full copies) limits this cost.

### 10.3 Concurrent Splits

Two devices may independently decide a document needs time-based splitting. Resolution:

- Both create new time-period documents with the same naming convention
- Automerge merge semantics handle the case where both wrote the same entities
- The manifest is server-authoritative — the server deduplicates identical doc IDs

### 10.4 Empty Documents

Documents created at system initialization (system-core, fronting, journal, privacy-config) start empty. Empty documents are valid — they consume minimal storage and avoid special-casing "no document exists yet."

### 10.5 Cross-Document References

Entities reference other entities by ID (branded string types), not by document location. The client resolves references by looking up the entity in the appropriate document based on entity type. The mapping table (section 4) is the authoritative source for "which document contains this entity type."

### 10.6 Blob/Media References

Binary media (images, attachments) are stored in S3-compatible blob storage (ADR 009), not in Automerge documents. Documents contain only `BlobId` references. Blob upload/download is a separate flow from CRDT sync.

### 10.7 Offline Fan-Out Backlog

If a source entity is updated while offline, bucket fan-out is queued locally. When the client reconnects:

1. Pending fan-out operations are replayed in order
2. If a BucketKey was rotated while offline, the client fetches the new key before fan-out
3. Stale fan-out (overwritten by newer changes) is deduplicated — only the latest state is projected

## 11. Downstream Task Interface

This section documents what each blocked downstream task needs from this topology specification.

### sync-pl87: Automerge Integration

Needs from this spec:

- Document type definitions (section 3) — what Automerge document schemas to create
- CRDT strategy per entity (section 4) — LWW map vs append-only list
- Document naming conventions — how to generate document IDs

### sync-mgcd: Partial Replication

Needs from this spec:

- Partial replication profiles (section 9) — which documents each client type syncs
- Manifest structure (section 8) — how clients discover available documents
- Friend access filtering — how the server filters the manifest for friend clients

### sync-t1rl: Protocol Messages

Needs from this spec:

- Document lifecycle (section 7) — what protocol messages correspond to create, sync, snapshot, split, archive operations
- Manifest sync flow (section 8) — the initial handshake and document negotiation protocol
- Compaction triggers (section 7.2) — when snapshots are created and how they relate to protocol messages

### sync-jr85: Encryption Integration

Needs from this spec:

- Encryption key assignment (section 5) — which key encrypts which document
- Bucket fan-out mechanics (section 3.6) — how projections are written and encrypted
- Key rotation impact (section 10.2) — how re-encryption affects CRDT documents
- secsync snapshot/change pattern (section 7.2) — the unit of encryption (individual changes + periodic snapshots)
