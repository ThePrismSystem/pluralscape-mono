---
# ps-wcr8
title: "Fix all PR #199 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-20T11:36:59Z
updated_at: 2026-03-20T11:58:04Z
---

Implement 8-commit plan fixing TOCTOU race, async Argon2id, error handling, rate limiters, migration sync, and test coverage for device transfer feature

## Summary of Changes

All PR #199 review issues addressed across 8 logical commits:

1. Export MS_PER_HOUR, fix DeviceTransferRequest.targetSessionId to be nullable
2. Update SQLite DDL test helpers to match schema (code_salt, code_attempts, nullable target_session_id)
3. Extend pwhash worker pool with deriveTransferKey offload (async Argon2id)
4. Harden device-transfer service: TOCTOU fix via atomic counters, narrowed error handling, DB time for expiry, column projection, transaction wrapping
5. Fix rate limiters: account-keyed initiation, per-transfer completion
6. Add SQLite cleanup query, lighter retry policy, pubsub fixes
7. Comprehensive unit test updates for new patterns
8. Integration test for sqliteCleanupDeviceTransfers, e2e test assertion fix
