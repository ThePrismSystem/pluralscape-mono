---
# ps-f5mh
title: "Zero-knowledge violation: migrate server-side master key operations to client"
status: in-progress
type: bug
priority: critical
created_at: 2026-04-15T07:34:35Z
updated_at: 2026-04-15T10:11:04Z
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
