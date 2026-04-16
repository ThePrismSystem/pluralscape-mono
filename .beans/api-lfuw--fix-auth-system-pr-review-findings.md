---
# api-lfuw
title: Fix auth system PR review findings
status: completed
type: task
priority: normal
created_at: 2026-03-17T00:44:45Z
updated_at: 2026-04-16T07:29:43Z
parent: api-o89k
---

Address 3 critical, 10 important, and 6 suggestion-level issues found in PR #145 auth review

## Summary of Changes

- Added `auth.register` audit event type to union and DB CHECK constraint
- Initialized libsodium before mounting auth routes (prevents CryptoNotReadyError)
- Replaced Math.random() with CSPRNG in fake recovery key generation
- Used PG error code (23505) for duplicate email detection instead of string matching
- Wrapped login, revoke, and logout operations in database transactions
- Added timing equalization for anti-enumeration on duplicate email registration
- Replaced 3 sequential session-auth queries with single JOIN query
- Fixed cascading idle timeout matching to use exact TTL comparison
- Added keypair secret key zeroing in finally block
- Changed registration audit event from auth.login to auth.register
- Filtered expired sessions in listSessions
- Added JSON parse error handling in register and login routes
- Fixed parseInt NaN handling for session limit parameter
- Removed unnecessary `as string` type casts in session routes
- Added error handling for fire-and-forget lastActive update
- Added pepper length validation and audit metadata truncation
- Updated all affected tests and added new test cases
