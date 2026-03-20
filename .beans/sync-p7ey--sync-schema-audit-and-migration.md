---
# sync-p7ey
title: Sync schema audit and migration
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T00:48:46Z
parent: sync-qxxo
---

Verify \`sync_documents\`/\`sync_queue\` tables match the document-ID model from the protocol spec (not entity-level). Migrate if needed.

## Acceptance Criteria

- Schema supports document IDs like \`fronting-sys_abc-2026-Q1\` (time-split partitioned)
- seq is monotonic per document (not global)
- Indexes support efficient fetchChangesSince(docId, seq) queries
- Migration is backwards-compatible if sync tables already have data
- Schema parity test updated to include sync tables

## Summary of Changes

- Rewrote `sync_documents` table from entity-level to document-level model (document_id PK, doc_type, size_bytes, snapshot_version, last_seq, archived, time_period, key_type, bucket_id, channel_id)
- Replaced `sync_queue` with `sync_changes` table (encrypted change envelopes with dedup index)
- Replaced `sync_conflicts` with `sync_snapshots` table (one per document)
- Added `SyncDocType` and `SyncKeyType` type unions to types package
- Removed `SyncOperation`, `SyncResolution`, `SyncQueueItem`, `SyncConflict` types
- Updated all downstream: schema indexes, test helpers, integration tests, barrel tests, enum arrays
