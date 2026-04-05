---
# sync-sqfo
title: Use branded ID keys in CRDT sync schema Record types
status: completed
type: task
priority: deferred
created_at: 2026-03-26T12:23:26Z
updated_at: 2026-04-04T22:43:00Z
---

Change Record<string, CrdtX> to Record<XId, CrdtX> in CRDT sync schemas (bucket.ts, chat.ts, fronting.ts, journal.ts). Needs serialization impact analysis. Deferred from M5 audit (L9).

## Summary of Changes

Branded all `Record<string, CrdtX>` keys in CRDT schema files with their corresponding ID types from `@pluralscape/types`. Updated all test files to use `as*Id()` cast helpers from `test-crypto-helpers.ts`, added new helpers for missing ID types (BucketId, NoteId, BoardMessageId, etc.). Updated production code (`time-split.ts`, `friend-projection.ts`) with safe iteration casts at `Object.entries()` boundaries.
