---
# api-fj88
title: Hash session tokens and redact from listings and audit logs
status: completed
type: bug
priority: high
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:44:15Z
parent: api-i2pw
---

Raw session bearer token is stored as DB sessions.id (not hashed), returned by listSessions, and logged in audit detail strings. Store BLAKE2b(token) as session ID, return only opaque display-safe identifiers, truncate/hash in audit logs. Ref: audit S-4.

## Tasks

- [x] Add tokenHash column to PG and SQLite schemas + migration
- [x] Create hashSessionToken() and generateSessionToken() utility
- [x] Update session creation (register/login) to store token hash
- [x] Update session validation to use tokenHash lookup
- [x] Update auth middleware for new token format
- [x] Verify audit log detail strings use safe session IDs
- [x] Update all auth/session tests

## Summary of Changes

Implemented session token hashing security fix:

- Added `tokenHash` column (varchar 128, unique indexed) to sessions table in both PG and SQLite schemas
- Created `generateSessionToken()` (32 random bytes, hex-encoded) and `hashSessionToken()` (BLAKE2b via libsodium) utilities
- Updated `registerAccount()` and `loginAccount()` to generate separate session ID + random token, store hash in DB, return raw token to client
- Updated `validateSession()` to hash incoming Bearer token and lookup by `tokenHash` instead of `id`
- Changed auth middleware token format validation from `sess_` prefix check to 64-char hex pattern
- Anti-enumeration fake tokens now use `generateSessionToken()` instead of `createId()`
- Audit log detail strings already use session `id` (safe `sess_<uuid>`) — verified correct
- All 1107 API tests pass
