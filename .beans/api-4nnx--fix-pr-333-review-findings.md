---
# api-4nnx
title: "Fix PR #333 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-30T15:10:24Z
updated_at: 2026-04-16T07:29:50Z
parent: ps-n8uk
---

Address 2 critical bugs, 4 important issues, and 3 suggestions from PR #333 agent review

## Todo

- [x] Auth guard + unsafe cast fix (Critical #1 + Suggestion #8)
- [x] JSON.parse crash protection (Critical #2)
- [x] Memory store lazy eviction + periodic sweep (Important #3)
- [x] Shutdown cleanup (Important #4)
- [x] store.set() failure resilience (Important #5)
- [x] Skip caching 5xx responses (derived from error test)
- [x] Inline envelope consistency (Suggestion #7)
- [x] Missing test branches (Suggestion #9)
- [x] Full verification (typecheck, lint, unit, integration, e2e)
- [x] Fix pre-existing E2E failures (envelope wrapping assertions)

## Summary of Changes

### Critical fixes

- **Auth guard**: Replaced unsafe `as` cast in idempotency middleware with runtime narrowing; unauthenticated routes skip idempotency
- **JSON.parse protection**: Wrapped Valkey store `JSON.parse` in try/catch; corrupt entries are deleted and logged
- **5xx skip**: Server errors are not cached by idempotency (transient errors should be retryable)

### Important fixes

- **Memory store**: Added lazy eviction on `get()`, periodic sweep via `setInterval().unref()`, and `disconnect()` method
- **Shutdown cleanup**: Idempotency store disconnected during graceful shutdown
- **store.set() resilience**: Cache write failures are caught and logged without masking successful mutations

### Suggestions

- **Envelope consistency**: 4 list routes now use `envelope()` instead of inline `{ data: result }`
- **Test coverage**: 7 new unit tests (conflict, error, unauth, TTL expiry, lazy eviction, lock TTL, cursor passthrough)
- **E2E fixes**: Fixed 12 pre-existing E2E failures from envelope wrapping drift
