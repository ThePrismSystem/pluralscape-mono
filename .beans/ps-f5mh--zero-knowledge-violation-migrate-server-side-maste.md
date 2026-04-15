---
# ps-f5mh
title: "Zero-knowledge violation: migrate server-side master key operations to client"
status: completed
type: bug
priority: critical
created_at: 2026-04-15T07:34:35Z
updated_at: 2026-04-15T10:47:20Z
---

The server generates and handles plaintext master key material in 4 code paths (registration, password change, recovery key regeneration, password reset). This violates the stated zero-knowledge architecture. All key generation and derivation must move to the client, with the server only storing opaque encrypted blobs.

## Progress (2026-04-15)

Refactored all remaining password hashing references in the API:

- Replaced / with synchronous from
- Replaced DB column references with
- Removed second argument from calls
- Updated all test files (unit + integration) to match new API surface
- Fixed tRPC parity check: mapped new two-phase registration routes, added to REST-only allowlist
- Fixed pre-existing test failures: recovery-key Buffer vs Uint8Array equality, system-purge hex validation

## Summary of Changes

- Added split key derivation (Argon2id → auth_key + password_key) to crypto package
- Removed server-side password hashing (hashPassword/verifyPassword)
- Collapsed server/mobile KDF profiles into unified 64MiB/4iter profile
- Renamed passwordHash → authKeyHash in DB schema (BLAKE2B binary)
- Added challenge nonce columns and salt-fetch endpoint with anti-enumeration
- Rewrote registration as two-phase (initiate + commit) protocol
- Rewrote login to verify BLAKE2B(auth_key) instead of Argon2id password hash
- Rewrote password change, recovery key regen, and password reset to accept pre-encrypted blobs
- Updated tRPC routers, REST routes, validation schemas, OpenAPI spec
- Updated E2E test infrastructure with client-side crypto
- Updated ADRs 006 and 013, architecture docs
- All 12,065 unit tests and 2,764 integration tests pass
