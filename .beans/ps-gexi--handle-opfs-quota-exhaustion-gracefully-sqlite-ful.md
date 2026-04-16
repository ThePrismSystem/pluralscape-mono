---
# ps-gexi
title: Handle OPFS quota exhaustion gracefully (SQLITE_FULL UX + recovery)
status: todo
type: feature
priority: normal
created_at: 2026-04-16T18:27:04Z
updated_at: 2026-04-16T18:27:04Z
parent: ps-vq2h
blocked_by:
  - mobile-shr0
---

When the OPFS-backed wa-sqlite database hits storage quota and a write fails with SQLITE_FULL, the user needs a clear, recoverable experience instead of an opaque crash. Today this is undefined behavior; mobile-shr0 will surface the underlying error as OpfsDriverError with code = SQLITE_FULL so callers have something to react to, but the actual UX + recovery flow lives here.

## Background

Browsers enforce per-origin storage quotas. OPFS counts toward that quota. Quota varies by browser, device, free disk, and user opt-ins (e.g. Chrome's persistent-storage permission can raise the cap). Realistic Pluralscape scenarios that could hit quota:

- A system with many years of journal entries + media references + CRDT history.
- A user importing a very large Simply Plural export on a device with low free space.
- Sustained CRDT growth in long-lived documents before compaction prunes change history.

When quota is hit, all subsequent writes fail. Reads usually still work. The failure cascades into the sync engine (saveSnapshot/appendChange reject), the offline queue (mutations can't be persisted), and the UI (data appears not to save).

## Required handling

### 1. Detection + classification

- Catch SQLITE_FULL from OpfsDriverError at the SqliteStorageAdapter / SqliteOfflineQueueAdapter boundary.
- Distinguish from other SQLite errors (corruption, busy, IO error). Each needs different handling; this bean focuses on FULL.
- Surface a typed event on the EventBus (e.g. storage:quota-exhausted) so the UI layer can react without polling.

### 2. UI surface

- Persistent banner / toast: "Storage full — your changes can't be saved. Free space or export your data."
- Modal flow with options:
  - Show storage usage breakdown (changes vs snapshots vs blobs by document type).
  - Trigger compaction (prune CRDT history before snapshot version N for healthy docs).
  - Export-and-purge specific documents (export journal entries from before date X, then delete locally).
  - Request persistent storage (navigator.storage.persist()) if not already granted — can raise the cap.
  - Link to a docs page explaining browser storage limits.
- Block destructive write operations with an inline error rather than silently dropping.

### 3. Recovery primitives

- Compaction trigger: storage adapter exposes a method to request CRDT compaction for a specific document (or all healthy docs). Implementation may already exist in packages/sync/src/compaction.ts — wire it through.
- Storage usage query: navigator.storage.estimate() for the gross numbers; per-table SUM(LENGTH(ciphertext)) queries for in-app breakdown.
- Persistent storage request: navigator.storage.persist() — one-shot prompt; idempotent.

### 4. Sync engine resilience

- When SQLITE_FULL is raised mid-sync, the engine must:
  - Stop pulling new changes (don't make the problem worse).
  - Hold pending outbound changes in memory rather than dropping (with a hard memory cap to prevent OOM).
  - Resume cleanly once space is freed.
- Document the behavior in docs/adr/ — quota handling deserves an ADR since it crosses storage, sync, and UI layers.

### 5. Telemetry (opt-in)

- If telemetry is enabled, count storage:quota-exhausted events and rough storage breakdowns at exhaustion time. Helps tune compaction defaults.
- No telemetry without opt-in (project policy).

## Acceptance

- SQLITE_FULL from the OPFS driver is caught and surfaced as a typed EventBus event.
- UI banner + recovery modal exist and pass accessibility audit.
- Compaction-from-UI works end-to-end and recovers space.
- Sync engine survives a quota event without data loss (Playwright E2E exercises the scenario by filling the quota, attempting a write, freeing space, confirming sync resumes).
- ADR documents the cross-layer behavior.

## Pointers

- mobile-shr0 — surfaces the error.
- packages/sync/src/compaction.ts — existing CRDT compaction primitives to reuse.
- packages/sync/src/event-bus/event-map.ts — where the new typed event is registered.
- VALUES.md — fail-closed privacy and deliberate data lifecycle principles inform "block writes loudly, never silently drop".
