---
# api-a2x5
title: Fix friend dashboard review issues
status: in-progress
type: task
priority: normal
created_at: 2026-03-28T03:39:32Z
updated_at: 2026-03-28T04:38:53Z
---

Fix all critical, important, and suggestion issues from multi-model PR review of PR #294 (external dashboard).

## Tasks

- [x] 1.1 Harden inverse connection lookup (add status/archived checks)
- [x] 1.2 Add multi-system assignment validation
- [x] 1.3 Fix fronting session visibility (use member/CF bucket tags)
- [x] 1.4 Fix friendAccountId typing (string -> AccountId)
- [x] 2.1 Add pagination limits to entity queries
- [x] 3.1 Replace verbose indexed-access type casts
- [x] 3.2 Extract filterAndMapEntities helper
- [x] 3.3 Batch loadBucketTags for large entity sets
- [x] 4.1 Update friend-access unit tests
- [x] 4.2 Expand friend-dashboard service unit tests
- [x] 5.1 Create integration test suite
- [x] 6.1 Fix weak E2E assertions
- [x] 6.2 Add fronting session E2E test
- [x] 6.3 Add custom front E2E test
- [x] 6.4 Add co-fronting E2E test
- [x] 7.0 Run full verification suite
