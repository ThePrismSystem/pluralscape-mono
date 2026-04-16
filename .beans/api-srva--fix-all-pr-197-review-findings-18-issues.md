---
# api-srva
title: "Fix all PR #197 review findings (18 issues)"
status: completed
type: task
priority: critical
created_at: 2026-03-20T11:35:02Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Address 4 critical, 8 important, 6 suggestion-level findings from multi-model review of PR #197 (feat/api-hardening-sse). Covers SSE subsystem (10), auth/throttle (6), biometric (1).

## Summary of Changes

### Step 1: Types — sseStream rate limit category (#14)

- Added `sseStream` rate limit (5 req/min) to `RATE_LIMITS` in api-constants.ts

### Step 2: SseEventBuffer circular buffer rewrite (#3, #5, #12, #17)

- Replaced Array-based buffer with O(1) ring buffer (head/tail/count indices)
- Added restart detection: `since()` returns null when targetId >= nextId
- Added aged-out gap detection: returns null when aged events create gaps
- Added `lastAssignedId` getter for full-sync events
- Typed timestamps as `UnixMillis`

### Step 3: SSE stream refactor (#2, #4, #5, #6, #9, #10, #14, #18)

- Replaced `accountBuffers` Map with `AccountSseState` (buffer + streams + handler)
- Single Valkey subscription per account, fanned out to all tab streams
- try/finally cleanup prevents resource leaks on disconnect
- Logs malformed JSON messages and missing pub/sub (once)
- Uses `sseStream` rate limit category
- Full-sync event uses `lastAssignedId` instead of `currentId`

### Step 4: AccountLoginStore async + eviction fix (#11, #15, #16)

- Interface methods now return Promises (async-ready for Redis backing)
- Force-evicts oldest non-expired entries when over capacity after expired sweep
- Exported `ACCOUNT_LOGIN_MAX_ENTRIES` for testability

### Step 5: Auth throttle on emailHash + CAS rehash (#1, #8, #16)

- Moved throttle check BEFORE DB lookup, keyed on emailHash (prevents account enumeration)
- Records failures on not-found path too (identical 429 for any email)
- Added CAS guard on password rehash (WHERE passwordHash = old hash)
- Typed `LoginThrottledError.windowResetAt` as `UnixMillis`

### Step 6: Fixed Retry-After header (#13)

- Replaced dynamic Retry-After with fixed window duration (900s)
- Prevents timing information leakage

### Step 7: Biometric fire-and-forget audit (#7)

- Changed `await audit()` to `void audit().catch()` for failed biometric verification
- Prevents audit DB failures from masking 401 with 500
