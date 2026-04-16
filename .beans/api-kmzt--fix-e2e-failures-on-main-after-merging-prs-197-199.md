---
# api-kmzt
title: Fix E2E failures on main after merging PRs 197-199
status: completed
type: bug
priority: high
created_at: 2026-03-20T12:18:41Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Device-transfer: migration missing code_salt, code_attempts columns and wrong nullability on target_session_id. Sync dedup: EncryptedRelay.submit() lacks nonce-based dedup.

## Summary of Changes

### Migration fix (device-transfer)

- Added missing `code_salt` (bytea NOT NULL) and `code_attempts` (integer DEFAULT 0 NOT NULL) columns to device_transfer_requests table in pg and sqlite migrations
- Fixed `target_session_id` nullability from NOT NULL to nullable in both migrations
- Updated corresponding drizzle snapshot JSON files

### Sync relay dedup

- Added nonce-based dedup index to `EncryptedRelay.submit()` — returns existing seq for duplicate (documentId, authorPublicKey, nonce) submissions
- Cleans up dedup entries on LRU eviction
- Updated handler test mock to use unique nonces per call

### Worker thread resilience

- Added 30s dispatch timeout to pwhash-offload worker pool to prevent indefinite hangs
- Added synchronous `deriveTransferKey` fallback in device-transfer service when worker pool is unavailable (Bun runtime compatibility)
- Increased E2E test timeout for device-transfer tests (Argon2id cold-start)
