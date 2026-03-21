---
# api-pr0b
title: "Fix all PR #233 review issues"
status: completed
type: task
priority: high
created_at: 2026-03-21T19:47:36Z
updated_at: 2026-03-21T19:47:56Z
parent: api-0zl4
---

Fix 3 critical bugs, 4 important issues, and 8 suggestions from multi-model PR #233 review

## Summary of Changes

### Critical Bugs Fixed

- **C1**: Sessions pagination now returns HMAC-signed cursors via `toCursor()` instead of raw IDs
- **C2**: Lifecycle events route no longer double-decodes cursors through `parseCursor()` — passes raw cursor to service which has its own compound cursor scheme
- **C3**: LRU cache `set()`/`setVersioned()` now guard against memzero when the same Uint8Array reference is re-set (prevents corrupting in-use key material)

### Important Issues Fixed

- **I1**: `toCursor()` uses `now()` from `@pluralscape/types` instead of raw `Date.now()`
- **I2**: `toUnixMillis()` and `toUnixMillisOrNull()` now throw TypeError on NaN/Infinity
- **I3**: Pagination cursors are HMAC-signed with per-process ephemeral key for tamper detection (timing-safe comparison)
- **I4**: Removed local `HTTP_BAD_REQUEST` constant in favor of shared `http.constants.ts` import

### Suggestions Implemented

- **S1**: Merged duplicate catch blocks in `fromCursor()`
- **S2**: Renamed `CursorExpiredError` to `CursorInvalidError` with `reason` discriminant (`expired` | `malformed`)
- **S3**: Removed redundant `jitterFraction` from account-purge policy (already in HEAVY_BACKOFF spread)
- **S4**: Added JSDoc to `has()` method clarifying it doesn't count as LRU access
- **S5**: Hardened 8 service tests with `fromCursor()` assertions verifying decoded cursor IDs
- **S6**: Added edge-case tests for `toUnixMillisOrNull` and `toUnixMillis` (NaN, Infinity, null, zero, negative)
- **S7**: Added `afterEach` cleanup to LRU eviction test suite
- **S8**: Renamed ambiguous `hi`/`lo` BigInt variables to `a`/`b` and `UINT32_HI_BYTE_OFFSET` to `UINT32_SECOND_OFFSET`
