---
# ps-d19i
title: "Fix all PR #163 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-18T08:38:05Z
updated_at: 2026-03-18T08:53:29Z
---

Fix all critical, important issues and implement all suggestions from PR review

## Summary of Changes

### Critical Issues Fixed

- mockDb tests now verify WHERE clause predicates using Drizzle expression matching (blob-archiver, orphan-blob-query, member-helpers, system-ownership)
- Collapsed duplicate member-helpers failure tests into one per function (3→1 for assertMemberActive, 2→1 for assertFieldDefinitionActive)

### Important Issues Fixed

- pwhash-offload.test.ts: replaced empty catch with documented void+catch pattern
- pwhash-worker-thread.test.ts: added missing afterEach(vi.restoreAllMocks)
- validate-encrypted-blob.test.ts: consolidated repeated dynamic imports to single top-level import
- system-ownership.test.ts: fixed `as never` to `as SessionId` for proper typing
- audit-log.test.ts: replaced untyped `c.set` mock with proper Context type from Hono

### Suggestions Implemented

- Created route-test-setup.ts harness (MOCK_AUTH + createRouteApp) used by all 25 route tests
- Parameterized 3 membership test files into 1 using for-loop over variants (618→~200 lines)
- Deleted blob-archiver idempotent test (identical to success test)
- Deleted orphan-blob-query cutoff test (didn't verify cutoff value)
- Fixed storage.test.ts duck-typing assertion to use toHaveProperty
- Added afterEach to pagination.test.ts for consistency
- Added body validation tests (empty `{}` body) to all POST/PUT routes
- Added 409 OCC conflict tests to entity/region/canvas update routes
- Added 404 test to canvas GET route
- Strengthened response assertions across all route tests to check more fields

### Test Count

Before: 1264 tests across 146 files
After: 1278 tests across 146 files (+14 deeper tests, 3 files consolidated into 1)
