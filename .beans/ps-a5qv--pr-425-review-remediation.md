---
# ps-a5qv
title: "PR #425 review remediation"
status: completed
type: task
priority: normal
created_at: 2026-04-14T07:50:10Z
updated_at: 2026-04-14T08:29:31Z
---

Fix all critical/important issues and suggestions from PR #425 multi-agent review

## Tasks

- [x] Task 1: Fix REST Client Retry Middleware
- [x] Task 2: Add tRPC retryLink Backoff
- [x] Task 3: Remove Dead Canvas Quota
- [x] Task 4: Strengthen ApiClientError and unwrap()
- [x] Task 5: Centralize Quota Constants
- [x] Task 6: Add Quota Boundary and Locking Tests
- [x] Task 7: Final Verification

## Summary of Changes

- **REST client retry** (critical): Added retry cap (1 attempt), NaN guard for Retry-After header, request cloning, and try/catch error handling. 6 new tests.
- **tRPC retryLink** (important): Extracted shouldRetryRateLimit function, added exponential backoff via retryDelayMs (1s/2s/4s). 5 new tests.
- **Canvas quota removal** (important): Removed dead quota check from singleton canvas service (systemId is PK). Cleaned up test mocks.
- **ApiClientError strengthening** (important): Typed code field with ApiErrorCode union, added path context, replaced unsafe as-cast with type guard. 2 new tests.
- **Quota centralization** (suggestion): Extracted all 15 quota constants into quota.constants.ts. Deleted bucket.constants.ts. Updated 22 files.
- **Test coverage gaps**: Added boundary (limit-1) and FOR UPDATE lock assertions to note, entity, and region services. 6 new tests.
