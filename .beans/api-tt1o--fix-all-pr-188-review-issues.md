---
# api-tt1o
title: "Fix all PR #188 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-19T02:59:15Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Address all 14 review issues from PR #188: SQL correctness, shutdown testability, signal handlers, access log try/finally, race conditions, and test gaps

## Summary of Changes

All 14 PR #188 review issues addressed:

**Critical (2):**

- Issue 2: Rewrote idle timeout SQL to use gte() with pre-computed threshold for index-friendly timestamptz comparisons
- Issue 14: Added expression index (sessions_ttl_duration_ms_idx) with EXTRACT(EPOCH FROM interval)\*1000 for TTL matching

**Important (8):**

- Issue 1: Shutdown errors now caught, logged, and exit with code 1
- Issue 3: Access log middleware uses try/finally to log even on unhandled throws
- Issue 4: Removed all `as SQL` casts, replaced with invariant guards
- Issue 5: Fixed race condition in getDb() with pendingInit promise cache
- Issue 6: Removed redundant not(isNull(sessions.lastActive)) guard
- Issue 7: Signal handlers registered outside Bun block
- Issue 9: setDbForTesting now accepts optional rawClient parameter
- Issue 10: Extracted shutdown() as testable module-level export (no process.exit)

**Suggestions (4):**

- Issue 8: Added JSDoc to Closeable.end() specifying timeout unit is seconds
- Issue 11: Added requestId field to access log output
- Issue 12: Added session-idle-filter tests for threshold values, NOT IN condition, boundary values
- Issue 13: Added vi.resetModules() in client-factory test beforeEach
