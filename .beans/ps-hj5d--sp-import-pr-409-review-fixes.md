---
# ps-hj5d
title: SP import PR 409 review fixes
status: completed
type: task
priority: normal
created_at: 2026-04-11T22:01:57Z
updated_at: 2026-04-16T07:29:55Z
parent: ps-dvxb
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
- [x] Task 15: Full verification + commit 2 (squashed as d75f6a04)

### Commit 3 — Type/simplification/comments

- [x] Task 16: SPCustomFieldType literal union + exhaustive switch
- [x] Task 17: Exhaustive switches in api-source iterate/buildUrl
- [x] Task 18: api-source cleanup (listCollections, LISTABLE_COLLECTIONS, substituteSystem, comment)
- [x] Task 19: channel truthy check + mapper-dispatch guard + helpers comment
- [x] Task 20: Wire warnDropped into board-message and member mappers
- [x] Task 21: persister-dispatch comment + Timestamp int finite + memberName helper typed
- [x] Task 22: Full verification + commit 3 + push (squashed as ebed4515)

## Summary of Changes

Resolved all 26 findings from the PR #409 six-agent review pass in three
commits on fix/sp-import-audit-findings:

1. **Source contract warn-and-skip** (46a3d4bd): ImportDataSource.iterate
   now yields a SourceEvent discriminated union (doc|drop). File-source
   emits drops instead of silent continues; api-source emits drops instead
   of throwing ApiSourcePermanentError. Engine handles drops as non-fatal
   failures and warns on DEPENDENCY_ORDER collections absent from the
   source. New bumpCollectionTotals helper preserves checkpoint cursor for
   null-sourceId drops.

2. **Correctness fixes + characterization tests** (d75f6a04):
   fractionalIndexToOrder decodes pre-migration numeric orders base-10
   (was silently base-36); poll synthetic option ids prefixed with poll
   \_id to prevent cross-poll collisions; buildPersistableEntity exported
   with unit tests; characterization tests for buckets: [] fail-closed,
   non-live fronting sessions with omitted endTime, poll omitted options.

3. **Type discipline + cleanup** (ebed4515): SPCustomFieldType literal
   union with named constants and exhaustive switch; ApiFetchStrategy
   exhaustive switches in api-source iterate/buildUrl; api-source
   listCollections double-cast eliminated; substituteSystem replaceAll;
   channel.mapper truthy check; mapper-dispatch unreachable guard removed
   (toRecord widened to accept unknown); warnDropped helper wired into
   board-message and member mappers; helpers.ts and api-source comments
   rewritten; persister-dispatch audit-date sentence removed; Timestamp
   schema tightened (.int()); memberName e2e helper typed.
