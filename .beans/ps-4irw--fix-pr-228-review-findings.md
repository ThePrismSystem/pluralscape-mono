---
# ps-4irw
title: "Fix PR #228 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-21T06:06:31Z
updated_at: 2026-03-21T06:15:10Z
---

Fix all critical, important, and suggestion issues from PR review

## Summary of Changes

**Critical fixes:**

1. Fixed `handlers.ts` accessing `.envelopes` on flat array from `collectAllEnvelopes` — reverted to direct array access
2. Fixed `pruneDedupForDocument` using `snapshotVersion` (compaction counter) instead of document's current seq — now uses `seqCounters.get(docId)`

**Important fixes:** 3. Added cross-document dedup key collision cleanup — removes stale `dedupByDoc` entry when overwriting 4. Added `EnvelopeLimitExceededError` → `QUOTA_EXCEEDED` handling in `handleSubmitChange`, and `SnapshotSizeLimitExceededError` → `QUOTA_EXCEEDED` in `handleSubmitSnapshot` 5. Fixed `MockSyncTransport` bare catch to discriminate `SnapshotVersionConflictError` vs `SnapshotSizeLimitExceededError` instead of catching all as `VERSION_CONFLICT`

**Suggestions implemented:** 6. Added JSDoc to `getManifest` explaining the stub is intentional (lacks metadata for real entries) 7. Added comment about ES2015 Set iterator safety for mid-loop deletion 8. Added tests: snapshot version conflict (3 tests), snapshot size boundary (2 tests), cross-document dedup collision (2 tests), getManifest shape (1 test), updated prune test to use divergent snapshotVersion

**Pre-existing fixes:**

- Fixed missing `await` in post-merge-validator 3-node cycle test
- Fixed sync-engine-runtime-hardening test: updated PostMergeValidator class import to module import, added missing `errors` field
- Fixed 2 handler tests accessing sync relay return as flat array instead of PaginatedEnvelopes
