---
# api-ghp5
title: Friend network E2E tests and OpenAPI
status: done
type: feature
created_at: 2026-03-26T16:04:19Z
updated_at: 2026-03-27T00:45:00Z
parent: api-rl9o
blocked_by:
  - api-ivfs
---

E2E tests: full friend code lifecycle, connection management, bucket assignment, visibility settings. OpenAPI spec additions. Files: apps/api-e2e/src/tests/friends/ (new), apps/api-e2e/src/fixtures/friend.fixture.ts (new). Friend fixture creates two accounts, establishes connection, assigns buckets, creates key grants.

## Summary of Changes

Implemented friend network E2E tests covering the full HTTP contract:

- `apps/api-e2e/src/fixtures/friend.fixture.ts`: Playwright fixture that registers two accounts, generates a friend code on account A, redeems it from account B, and provides both auth contexts and bidirectional connection IDs
- `apps/api-e2e/src/tests/friends/codes.spec.ts`: Friend code lifecycle tests (generate, list, archive, self-redeem prevention, invalid format, cross-account redemption with bidirectional verification)
- `apps/api-e2e/src/tests/friends/lifecycle.spec.ts`: Friend connection lifecycle tests (list connections, get individual, bucket assignment/list/unassign, visibility update, block, remove, archive/restore, 404 for non-existent, cross-account access prevention)
