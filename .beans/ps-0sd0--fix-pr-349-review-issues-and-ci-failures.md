---
# ps-0sd0
title: "Fix PR #349 review issues and CI failures"
status: completed
type: task
priority: normal
created_at: 2026-03-31T20:50:52Z
updated_at: 2026-03-31T21:19:11Z
parent: ps-4ioj
---

Fix FOR UPDATE + window function CI failure, tx.execute driver inconsistency, idle timeout fail-open, idempotency log noise, and add missing tests

## Summary of Changes

1. **auth.service.ts** — Split session eviction into count query + conditional lock query (avoids FOR UPDATE + window function conflict)
2. **friend-code.service.ts** — Replaced tx.execute() with drizzle query builder using NOW() comparison (fixes PGlite driver inconsistency)
3. **session-auth.ts** — Changed idle timeout fallback from returning 0 to throwing (fail-closed)
4. **idempotency.ts** — Truncated cacheKey to 20 chars in warning log
5. **idempotency.test.ts** — Added tests for empty body hash consistency and authenticated-user keying
6. **auth.service.test.ts** — Updated mocks for two-query session eviction pattern
7. **friend-code.service.test.ts** — Updated expired code mock to use .limit() instead of .execute()
8. **session-auth.test.ts** — Added test for throw on empty idle timeouts
