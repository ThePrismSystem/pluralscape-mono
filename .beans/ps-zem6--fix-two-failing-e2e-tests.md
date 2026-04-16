---
# ps-zem6
title: Fix two failing E2E tests
status: completed
type: bug
priority: normal
created_at: 2026-03-20T17:53:54Z
updated_at: 2026-04-16T07:29:47Z
parent: ps-afy4
---

Fix device-transfer timeout (worker thread race condition) and sync dedup (missing dedup in EncryptedRelay)

## Summary of Changes

- **pwhash-worker-thread.ts**: Register message listener synchronously before async sodium init, queue messages received during init, drain on ready — fixes race condition causing 30s timeout in device-transfer E2E test
- **relay.ts**: Add dedup logic to EncryptedRelay.submit() checking (documentId, authorPublicKey, nonce) — matches PgSyncRelayService behavior, fixes sync dedup E2E test
- **handlers.test.ts**: Generate unique nonces per mock change to avoid false dedup matches
