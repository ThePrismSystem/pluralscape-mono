---
# api-5bln
title: Complete transfer endpoint
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-20T10:32:47Z
parent: crypto-og5h
---

Implement \`POST /v1/account/device-transfer/:id/complete\`. Target device provides code, server verifies against stored Argon2id hash, writes encryptedKeyMaterial.

## Acceptance Criteria

- Wrong code → 403 Forbidden (no detail about what was wrong)
- Expired transfer → 410 Gone
- Already-completed transfer → 409 Conflict
- Successful verification → encryptedKeyMaterial written, status set to approved
- Rate limited per transfer ID (max 5 attempts per transfer)
- Unit tests for each error case and success path

## Summary of Changes

- Added `completeTransfer()` to device-transfer service
- Created `POST /:id/complete` route with per-account rate limiting
- Derives transfer key via Argon2id, verifies code by attempting decryption
- Increments `codeAttempts` on failure, expires after MAX_TRANSFER_CODE_ATTEMPTS (5)
- Returns encrypted key material hex on success, marks transfer as approved
