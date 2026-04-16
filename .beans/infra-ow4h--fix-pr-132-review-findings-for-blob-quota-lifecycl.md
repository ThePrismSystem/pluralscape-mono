---
# infra-ow4h
title: "Fix PR #132 review findings for blob quota lifecycle"
status: completed
type: task
priority: normal
created_at: 2026-03-16T03:35:47Z
updated_at: 2026-04-16T07:29:40Z
parent: infra-o80c
---

Address all 10 issues from multi-agent PR review: error isolation in cleanup loop, branded types, named return types, TOCTOU docs, test fixes, error propagation tests

## Summary of Changes

- **Error isolation in cleanup loop** (Critical): Wrapped per-key delete+archive in try/catch so a single failure doesn't abort the entire cleanup. Added `failedCount` and `failedKeys` to `CleanupResult`.
- **Branded types** (Suggestion): Adopted `StorageKey` and `SystemId` from `@pluralscape/types` across all interfaces, errors, adapters, quota services, and tests.
- **Named return type** (Important): Extracted `BlobUsageResult` interface for `getUsage()` return type, exported from barrel.
- **TOCTOU documentation** (Important): Added JSDoc on `checkQuota`/`assertQuota` noting TOCTOU race and recommending DB-level constraints.
- **BlobArchiver idempotency JSDoc** (Important): Documented that implementations MUST be idempotent.
- **Fixed idempotency test** (Important): Now calls `cleanup()` twice and verifies both succeed.
- **Replaced magic number** (Suggestion): Orphan detector test uses `DEFAULT_GRACE_PERIOD_MS` constant.
- **Fixed unsafe `as` cast** (Suggestion): Replaced `as QuotaExceededError` with `instanceof` narrowing.
- **Error propagation tests** (Suggestion): Added tests for detector/archiver/query failure paths in cleanup-job, orphan-detector, and quota-service.
