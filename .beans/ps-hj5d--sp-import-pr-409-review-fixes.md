---
# ps-hj5d
title: SP import PR 409 review fixes
status: in-progress
type: task
priority: normal
created_at: 2026-04-11T22:01:57Z
updated_at: 2026-04-11T23:13:52Z
---

Resolve all PR #409 review findings (critical, important, and suggestions) from the 6-agent review pass. Tracked in docs/planning/2026-04-11-sp-import-pr-409-review-fixes.md.

## Task Checklist

Plan: docs/superpowers/plans/2026-04-11-sp-import-pr-409-review-fixes.md

### Commit 1 — Source contract

- [x] Task 1: Add invalid-source-document to ImportFailureKind
- [x] Task 2: Replace SourceDocument with SourceEvent discriminated union
- [x] Task 3: Add bumpCollectionTotals helper
- [x] Task 4: Engine handles drop events + missing-collection warnings
- [x] Task 5: Migrate file-source to emit SourceEvent
- [x] Task 6: Migrate api-source to emit SourceEvent
- [x] Task 7: Migrate fake-source to emit SourceEvent
- [x] Task 8: Fix remaining SourceDocument consumers (folded into Task 7; stale comment in file-source.ts fixed inline)
- [x] Task 9: Full verification + commit 1 (squashed as 46a3d4bd)

### Commit 2 — Correctness + tests

- [x] Task 10: Characterization tests for buckets [] fail-closed
- [x] Task 11: Non-live fronting session endTime omitted test
- [ ] Task 12: Poll synthetic option ids prefixed with \_id
- [x] Task 13: fractionalIndexToOrder numeric correctness fix
- [x] Task 14: buildPersistableEntity runtime guard unit test
- [ ] Task 15: Full verification + commit 2

### Commit 3 — Type/simplification/comments

- [ ] Task 16: SPCustomFieldType literal union + exhaustive switch
- [ ] Task 17: Exhaustive switches in api-source iterate/buildUrl
- [ ] Task 18: api-source cleanup (listCollections, LISTABLE_COLLECTIONS, substituteSystem, comment)
- [ ] Task 19: channel truthy check + mapper-dispatch guard + helpers comment
- [ ] Task 20: Wire warnDropped into board-message and member mappers
- [ ] Task 21: persister-dispatch comment + Timestamp int finite + memberName helper typed
- [ ] Task 22: Full verification + commit 3 + push
