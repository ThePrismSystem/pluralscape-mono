---
# api-n7cz
title: Fix all friend network PR review issues
status: completed
type: task
priority: normal
created_at: 2026-03-27T02:14:10Z
updated_at: 2026-03-27T04:55:49Z
---

Fix all critical, important, and suggested issues from the multi-model PR review of PR #291. Covers RLS cross-account fix, bilateral block/remove, key rotation signaling, validation, type cast removal, projection fixes, service improvements, and missing tests.

## Summary of Changes

### Critical Fixes

- Added `withCrossAccountTransaction` helper to `rls-context.ts` for cross-account operations
- Fixed RLS scope mismatch in `redeemFriendCode` — uses cross-account transaction
- Added Zod validation to bucket assign route (was using unsafe `as string`/`as number` casts)
- Made block/remove bilateral — both directions updated atomically
- Added `pendingRotations` return to block/remove/unassign to signal client-driven key rotation
- Added `FOR UPDATE` row locking to friend code quota check (prevents concurrent bypass)

### Code Quality

- Registered `CONNECTION_NOT_ACCEPTED` in `ApiErrorCode` union
- Removed 11 vestigial `as AuditEventType` casts across 3 service files
- Removed 2 `as FriendConnectionStatus` casts (already valid union members)
- Removed `as ApiErrorCode` cast from bucket-assignment service

### Projection Fixes

- Added `createdAt`/`updatedAt` to `FriendConnectionInput`, removed `Date.now()`
- Branded all ID fields (`FriendCodeId`, `AccountId`, `BucketId`, etc.)
- Narrowed `status` parameter to `FriendConnectionStatus`
- Added logger warnings for silent entity-not-found drops in CRDT projections
- Replaced `bucketArrayToMap` with `Object.fromEntries`

### Service Improvements

- Increased friend code entropy from 5 to 8 bytes with BigInt-based encoding
- Added retry loop (3 attempts) for unique constraint collisions
- Moved `createId()`/`now()` inside transaction for consistency
- Extracted shared `transitionConnectionStatus` helper (reduced ~100 lines duplication)

### Tests Added

- 9 new route unit test files (34 tests)
- 5 new service unit tests (pending transitions, error guards)
- 3 new integration tests (includeArchived, malformed cursor)
- 1 new E2E test (already-friends 409)
- Updated all existing tests for behavioral changes
