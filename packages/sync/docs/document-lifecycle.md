# Document Lifecycle Specification

## 1. Overview

This specification operationalizes the document lifecycle sections of the document topology (sections 7.1–7.5). It defines concrete triggers, procedures, and configuration for compaction, time-based splitting, purging, storage budgets, and archival of Automerge CRDT documents.

Implementation of these rules is M3 scope. This document is the authoritative design input for that work.

**Cross-references:**

- `document-topology.md` — foundational topology, document types, naming conventions
- `conflict-resolution.md` — tombstone/archival semantics (archived entities are included in snapshots)
- `partial-replication.md` — which documents are synced by which client profile

---

## 2. Compaction Strategy

### 2.1 What Compaction Does

Automerge documents accumulate change history indefinitely. Each change is a small delta (operation log entry). Over time, the change history can dwarf the current document state. Compaction creates a **snapshot** — a full serialization of current document state (`Automerge.save()`) — and discards accumulated change history prior to the snapshot.

Benefits:

- New devices download the snapshot + only changes since the snapshot, not the full history
- Document storage on server decreases significantly (60–70% reduction typical)
- CRDT merge on new devices is O(changes since snapshot), not O(all-time changes)

### 2.2 Compaction Triggers

Compaction is eligible when **any** of the following is true:

| Trigger                      | Threshold                           | Notes                                                              |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| Change count since snapshot  | > 200 changes                       | Tracked in client sync state as `changesSinceSnapshot`             |
| Size increase since snapshot | > 1 MB increase since last snapshot | Measured lazily every 10 changes via `Automerge.save().byteLength` |
| Explicit user sync           | Always eligible                     | E.g., before logout or on explicit "sync now" action               |

**Default compaction configuration:**

```typescript
const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  changeThreshold: 200,
  sizeThresholdBytes: 1_048_576, // 1 MB
};
```

### 2.3 Compaction Process

1. **Check eligibility:** `checkCompactionEligibility(session) => CompactionCheck`
2. **Create snapshot:** `session.createSnapshot(nextSnapshotVersion)` — produces an `EncryptedSnapshotEnvelope`
3. **Submit snapshot:** `adapter.submitSnapshot(documentId, snapshot)` — server validates `snapshotVersion` strictly increases
4. **Prune changes:** `pruneChangesBeforeSnapshot(documentId, snapshotVersion)` — removes all changes with `seq <= snapshotVersion` from local storage and server
5. **Reset counter:** `changesSinceSnapshot = 0`

### 2.4 Concurrent Compaction

Two devices may both attempt compaction simultaneously:

- Each device calls `submitSnapshot` with its local `snapshotVersion`
- Server accepts the **highest** `snapshotVersion` received; rejects equal or lower versions with a version conflict error
- The losing device receives the rejection, fetches the winning snapshot from the server, loads it, and continues
- Net result: the highest-version snapshot wins; no data is lost

### 2.5 Archived Entities in Snapshots

Per the tombstone lifecycle spec (conflict-resolution.md), snapshots include archived entities in their full current state. Compaction does **not** remove archived entities from snapshots. Lossy removal of archived entities is deferred to a future version requiring multi-device coordination.

### 2.6 `changesSinceSnapshot` Tracking

`changesSinceSnapshot` is a counter maintained in the client's sync state (not in the CRDT document). It increments with each locally-produced change and each remotely-received change applied. It resets to 0 after compaction. It is persisted locally alongside the document so it survives restarts.

---

## 3. Document Size Management

### 3.1 Measurement

Document size is measured via `Automerge.save(doc).byteLength`. This is the serialized CRDT state, which includes operation history since the last snapshot, actor tables, and current object graph.

Measurement is **lazy** — performed every 10 changes to avoid O(n) overhead on every mutation:

```typescript
// Pseudo-code for lazy size tracking
if (changesSinceLastSizeMeasure >= 10) {
  currentSizeBytes = Automerge.save(doc).byteLength;
  changesSinceLastSizeMeasure = 0;
}
```

### 3.2 Size Limits Per Document Type

| Document Type    | Maximum Size | Notes                                             |
| ---------------- | ------------ | ------------------------------------------------- |
| `system-core`    | 10 MB        | Bounded by entity count; 500+ members ≈ 2.5 MB    |
| `fronting`       | 20 MB        | Per time period; time-split at 5 MB               |
| `chat`           | 20 MB        | Per channel per period; time-split at 5 MB        |
| `journal`        | 50 MB        | Per time period; time-split at 10 MB              |
| `privacy-config` | 5 MB         | Low-frequency writes; should never approach limit |
| `bucket`         | 5 MB         | Projections only; bounded by source data          |

These limits are enforced client-side before writing. Exceeding the maximum triggers a `StorageBudgetExceededError` rather than blocking reads.

---

## 4. Time-Split Implementation

### 4.1 Split Decision

A document is eligible for splitting when the **active document** (current time period) exceeds the split threshold:

| Document Type | Split Unit | Split Threshold |
| ------------- | ---------- | --------------- |
| `fronting`    | Quarter    | 5 MB            |
| `chat`        | Month      | 5 MB            |
| `journal`     | Year       | 10 MB           |

**Configuration:**

```typescript
const TIME_SPLIT_CONFIGS: readonly TimeSplitConfig[] = [
  { documentType: "fronting", splitUnit: "quarter", splitThresholdBytes: 5_242_880 },
  { documentType: "chat", splitUnit: "month", splitThresholdBytes: 5_242_880 },
  { documentType: "journal", splitUnit: "year", splitThresholdBytes: 10_485_760 },
];
```

### 4.2 Split Procedure

When the active document exceeds the split threshold:

1. **Determine new time period:** compute current quarter/month/year string (e.g., `"2026-Q2"`, `"2026-04"`, `"2026"`)
2. **Create new Automerge document:** fresh empty doc with the same schema
3. **Register in manifest:** add a new `SyncManifestEntry` with the new `timePeriod` value and `archived: false`
4. **Migrate active entities** (where applicable):
   - `fronting`: clone any sessions without an `endTime` (active fronting sessions) to the new document
   - `chat` / `journal`: no migration — all new writes go to the new document; historical data stays
5. **Mark old document read-only:** old document's `SyncManifestEntry` gets `archived: false` but receives no new writes
6. **Redirect writes:** all new changes go to the new document

### 4.3 Active Document Resolution

The **active document** for a given type is the entry in the manifest with the latest `timePeriod` value for that type and system/channel ID.

```
active = manifest.documents
  .filter(d => d.docType === type && d.entityId === id)
  .sort by timePeriod descending
  .first()
```

For documents without `timePeriod` (system-core, privacy-config, bucket), there is exactly one active document per entity.

### 4.4 Cross-Split Queries

When displaying historical data that spans multiple time periods, the client:

1. Fetches all relevant manifest entries for the document type
2. Loads all period documents (from local cache or on-demand)
3. Concatenates results and sorts by the relevant timestamp field

Example: displaying fronting history across quarters → fetch all `fronting-{systemId}-YYYY-QN` documents, concatenate sessions, sort by `startTime`.

### 4.5 Concurrent Splits

Two devices may independently decide a document needs splitting:

- Both create new time-period documents with the same naming convention (e.g., both create `fronting-sys_abc-2026-Q2`)
- Automerge CRDT merge handles the case where both wrote the same entities to identically-named new documents
- The server deduplicates identical `docId` values in the manifest — both devices produce the same `docId`, so only one manifest entry exists

---

## 5. Purging Strategy

### 5.1 What Gets Purged

After a successful compaction (snapshot accepted by server), the following are eligible for purging:

- **All encrypted change envelopes** with `seq <= snapshotVersion` (both local and server-side)
- The old change log in local storage for that document

### 5.2 What Is Never Purged

- The latest snapshot
- Changes with `seq > snapshotVersion` (changes since the snapshot)
- Manifest entries (even for archived documents)
- Archived entities within the snapshot (they are part of current state)

### 5.3 Purge Sequence

1. Snapshot is accepted by server (server returns success for `submitSnapshot`)
2. Client requests server to prune changes: `DELETE /sync/{docId}/changes?maxSeq={snapshotVersion}`
3. Client prunes local change storage for the document
4. Client verifies local state: load snapshot from local storage, apply any changes with `seq > snapshotVersion`, confirm document state is valid

### 5.4 Roundtrip Invariant

After purge, the following must hold:

> `load(latestSnapshot) + applyAll(changesSinceSnapshot) === currentDocumentState`

This is verified by the client after each purge operation as a consistency check.

---

## 6. Storage Budget

### 6.1 Per-System Budget

| Deployment  | Default Budget                    |
| ----------- | --------------------------------- |
| Hosted      | 500 MB per system                 |
| Self-hosted | Configurable (no default maximum) |

**Default budget configuration:**

```typescript
const DEFAULT_STORAGE_BUDGET: StorageBudget = {
  maxTotalBytes: 524_288_000, // 500 MB
};
```

### 6.2 Budget Enforcement

- Budget is enforced **server-side** at change submission time
- **Reads are never blocked** — a system over budget can still fetch documents
- On budget exceeded: server returns `QUOTA_EXCEEDED` error; client surfaces `StorageBudgetExceededError`
- User is warned in the app UI when approaching budget (e.g., > 80% full)
- Compaction is the primary mechanism for staying within budget

### 6.3 Sync Priority Order

When storage is constrained, sync proceeds in priority order:

```typescript
const SYNC_PRIORITY_ORDER: readonly string[] = [
  "system-core",
  "privacy-config",
  "fronting", // current period first
  "chat", // active channels, current period
  "journal",
  "bucket",
  "fronting-historical",
  "chat-historical",
  "journal-historical",
];
```

On storage exceeded:

1. Evict archived (cold) documents from local storage first
2. Never evict `system-core` or `privacy-config`
3. Evict in reverse priority order (historical data first)

---

## 7. Archive / Cold Storage

### 7.1 Archive Trigger

A document is eligible for server-side archival when:

- No writes have been received for **90 days** (configurable on self-hosted)
- OR the document's time period is more than one period in the past (e.g., for `fronting`, any quarter before the current active quarter)

Archival is performed server-side and reflected in the manifest as `archived: true`.

### 7.2 Archive Behavior

| Behavior              | Rule                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| Not synced by default | Archived documents are not included in initial sync or incremental sync subscriptions |
| On-demand loadable    | Client can request an archived document via `OnDemandLoadRequest { docId, persist }`  |
| Un-archival on write  | Writing a change to an archived document automatically un-archives it in the manifest |
| Retained indefinitely | Server retains archived documents; non-destructive data principle                     |
| Readable              | Reads from archived documents are always permitted                                    |

### 7.3 UI Experience

- "Load older history" button triggers an on-demand load of archived documents
- Loaded documents are optionally persisted locally (`persist: true`) or kept in memory only
- The manifest always reflects which documents are archived so the UI knows what's available

---

## 8. Decision Log

### Why 200 changes as the compaction threshold?

The secsync reference implementation uses 100–200 as a typical range. At 200 changes per document per compaction cycle, compaction overhead is minimal for most systems (< 1 per day for casual users). Heavy fronting systems (~20 switches/day) would compact ~every 10 days. The 1 MB size trigger provides a secondary bound for burst-write scenarios.

### Why 1 MB as the size increase trigger?

1 MB represents a significant change accumulation that is worth compacting regardless of change count. This handles the case where changes are large (e.g., journal entries with large block content) and the change count threshold would be reached too slowly.

### Why no hard delete of individual entities?

Pluralscape's non-destructive data principle is a core design decision. Hard delete complicates CRDT semantics (tombstones can resurface if a device brings in old changes after deletion), creates potential for data loss in conflict scenarios, and is incompatible with the "fail-closed privacy" principle (preserving the last-known state of archived entities ensures their references in fronting logs remain resolvable). The only hard delete is GDPR account deletion, which is a clean server-side wipe of all ciphertext.

### Why 90 days for archive trigger?

90 days represents approximately one quarter — the natural granularity of fronting and other time-split documents. A document with no writes in one full quarter is likely historical. The threshold is configurable on self-hosted installations to accommodate different usage patterns.

### Why 500 MB default budget?

This accommodates a large system (500+ members) with several years of fronting history, active chat channels, and journal entries, with room for bucket projections. The estimate from document-topology.md section 6 shows large systems at ~23 MB+ for core documents. 500 MB provides ~20x headroom above the projected steady-state for a very large system.
