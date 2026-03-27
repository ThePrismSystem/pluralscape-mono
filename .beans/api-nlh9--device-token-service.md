---
# api-nlh9
title: Device token service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:32Z
updated_at: 2026-03-27T07:25:04Z
parent: api-nie2
---

Implement registerDeviceToken (upsert on token+platform), revokeDeviceToken, listDeviceTokens, updateLastActive. Tokens are T3 plaintext (server must read to deliver). Hook token revocation into auth/session invalidation (logout, session expiry, password change). Files: apps/api/src/services/device-token.service.ts (new). Tests: unit + integration; upsert, duplicate handling, revoke idempotency, session-lifecycle revocation.

## Summary of Changes

Implemented device-token.service.ts with registerDeviceToken (upsert on token+platform unique constraint), revokeDeviceToken (sets revokedAt, 404 if missing/already revoked), listDeviceTokens (non-revoked, newest first), and updateLastActive (for worker use). Full integration tests with PGlite.
