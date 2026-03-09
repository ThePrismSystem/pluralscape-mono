---
# types-lzek
title: Import and export types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:23:40Z
updated_at: 2026-03-09T06:04:17Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Types for Simply Plural import, PluralKit import, JSON/CSV export, and data deletion.

## Scope

- `SPImportPayload`: raw SP JSON export shape — members, fronting history, custom fields, groups, notes, chat, board messages, polls, timers, privacy buckets, friend data. MongoDB ObjectIds, epoch millisecond timestamps.
- `PKImportPayload`: PK JSON export (schema version 2) — members, switches, groups. 5-char IDs, ISO 8601 timestamps.
- `ImportJob`: id, source ('simply-plural'|'pluralkit'|'json'), status, progressPercent, errorLog, chunksTotal, chunksCompleted, createdAt, completedAt
- `ImportProgress`: current chunk, total chunks, entity counts (members imported, fronts imported, etc.)
- `ImportChunkResult`: success (boolean), entitiesProcessed, errors (ImportError[])
- `ImportError`: entityType, sourceId, message, recoverable (boolean)
- `ExportManifest`: format ('json'|'csv'), entityCounts, exportedAt, blobId
- `AccountPurgeRequest`: id, status, requestedAt, confirmedAt, completedAt
- `MemberReport`: bucketId (which bucket scopes the report), format ('html'|'pdf')
- `SystemOverviewReport`: selectedContent, format ('html'|'pdf') — 'Meet our system' report

## Acceptance Criteria

- [ ] SP and PK import payload types match their export formats
- [ ] Import job tracking with progress and error reporting
- [ ] Chunked import support for large datasets
- [ ] Export manifest type for download tracking
- [ ] Account purge request lifecycle
- [ ] Report generation types for bucket-scoped reports
- [ ] Unit tests for import payload validation

## References

- features.md section 10 (Data Portability)

## Summary of Changes

Implemented in `packages/types/src/import-export.ts` on branch `feat/types-interop`:

**Import payloads (external shapes, plain IDs):**

- `SPImportMember`, `SPImportGroup`, `SPImportFrontingSession`, `SPImportPayload` — Pluralscape export format
- `PKImportMember`, `PKImportGroup`, `PKImportSwitch`, `PKImportPayload` — PluralKit export format

**Import job tracking:**

- `ImportSource`: `"pluralscape" | "pluralkit"`
- `ImportJobStatus`: 5-state lifecycle
- `ImportProgress`, `ImportError`, `ImportJob`

**Export:**

- `ExportFormat`: `"json" | "csv"`
- `ExportManifest`: download metadata with expiry

**Account management:**

- `AccountPurgeRequest`: purge scheduling with confirmation
- `MemberReport`: downloadable member data report

Test file: `import-export.test.ts` (17 tests). SP payloads use `number` timestamps, PK payloads use `string` timestamps (matching their respective export formats).
