---
# sync-3lb6
title: Validate authorPublicKey against authenticated session identity
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:37Z
updated_at: 2026-04-14T10:28:36Z
---

AUDIT [SYNC-S-H1] handleSubmitChange verifies envelope signature using envelope.authorPublicKey but never checks it matches the authenticated system's registered signing key. Attacker can submit envelopes claiming any authorPublicKey. File: apps/api/src/ws/handlers.ts

## Summary of Changes

Added key ownership check to handleSubmitChange. The verifyKeyOwnership helper queries the auth_keys table to verify the envelope's authorPublicKey belongs to the authenticated account. Added UNAUTHORIZED_KEY error code to SyncErrorCode.
