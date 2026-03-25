---
# api-acdx
title: Note CRDT sync integration
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T15:14:22Z
parent: api-i16z
blocked_by:
  - api-yirj
---

Notes get their own NoteDocument CRDT schema (independent from ChatDocument). Create packages/sync/src/schemas/notes.ts with CrdtNote and NoteDocument types. Wire into document factory and subscription profiles. Tests: unit (document factory, merge, independent sync).

## Summary of Changes

Extracted notes from JournalDocument into a standalone NoteDocument CRDT schema:

- Created `packages/sync/src/schemas/notes.ts` with `CrdtNote` and `NoteDocument` types
- Removed `CrdtNote` and `notes` field from `JournalDocument` in journal.ts
- Added `"note"` to `SyncDocumentType` union and `SYNC_DOC_TYPES` enum array
- Added note document prefix config, parsed ID variant, and document factory
- Added note time-split config (year-based, 10 MiB threshold) and size limit (15 MiB)
- Added `"note"` and `"note-historical"` to sync priority order
- Updated all exhaustive switches: subscription-filter, time-split, document-factory
- Updated bucket.ts to import CrdtNote from notes.ts instead of journal.ts
- Updated barrel exports, conflict-resolution docs, and all affected tests

## Summary of Changes

Created `packages/sync/src/schemas/notes.ts` with CrdtNote and NoteDocument types (independent from JournalDocument). Wired into sync infrastructure: document-types.ts (prefix + ParsedDocumentId), document-factory.ts (createNoteDocument + createDocument switch), types.ts (TIME_SPLIT_CONFIGS, DOCUMENT_SIZE_LIMITS, SyncPriorityCategory, SYNC_PRIORITY_ORDER), sync.constants.ts (NOTE_SPLIT_THRESHOLD_BYTES, NOTE_SIZE_LIMIT_BYTES). All tests passing.
