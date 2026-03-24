---
# api-my95
title: "PR review fixes: read-only context, S3 extraction, tests, cleanup"
status: completed
type: task
priority: normal
created_at: 2026-03-24T23:26:27Z
updated_at: 2026-03-24T23:54:13Z
---

Fix all issues from PR review of security audit remediation: add withTenantRead/withAccountRead helpers, move S3 calls out of transactions, add tests for 9 untested security fixes, explicit headers, dedup WS code, optimize session eviction, add biometric index, document throttle asymmetry

## Summary of Changes

### Part 1: RLS Read-Only Context Helpers

- Added `withTenantRead` and `withAccountRead` to `rls-context.ts` with branded SystemId/AccountId types
- JSDoc documents why transactions are architecturally required for GUC scoping

### Part 2: Convert Read-Only Services (~25 functions)

- Converted all pure-SELECT operations across 13 service files from `withTenantTransaction`/`withAccountTransaction` to `withTenantRead`/`withAccountRead`

### Part 3: Move S3 Calls Out of Transactions

- `createUploadUrl`: DB insert + audit inside transaction, S3 presigned URL outside
- `getDownloadUrl`: SELECT inside `withTenantRead`, S3 presigned URL outside

### Part 4: Explicit Referrer-Policy

- Added `referrerPolicy: 'no-referrer'` to secure-headers.ts

### Part 5: Deduplicate IP Slot Release

- `releaseUnauthSlot` now delegates to `releaseIpSlot`

### Part 6: Session Eviction Query Optimization

- Replaced COUNT + SELECT with single window function query (`count(*) over()`)

### Part 7: Biometric Token Partial Index

- Added `biometric_tokens_unused_idx` partial index on `tokenHash WHERE used_at IS NULL`

### Part 8: Login Throttle Documentation

- Added comment explaining intentional try/catch asymmetry

### Part 9: Tests (17 new tests)

- RLS context helpers (16 tests)
- WS connection manager per-IP limiting (10 tests)
- WS envelope signature verification warning (6 tests)
- Session limiting (3 tests)
- generateFakeRecoveryKey format (3 tests)
- Anti-timing on password reset (3 tests)
- FOR UPDATE race condition verification (2 tests)
