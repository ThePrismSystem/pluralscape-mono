---
# api-nud7
title: Initiate transfer endpoint
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-20T10:32:42Z
parent: crypto-og5h
---

Implement \`POST /v1/account/device-transfer\`. Create device_transfer_request record, generate 8-digit code, return code to source device.

## Acceptance Criteria

- 400 if session not active or account not verified
- Generates cryptographically random 8-digit numeric code
- Code never stored plaintext — only Argon2id-derived key stored
- Transfer request created with 5-minute expiry (expiresAt)
- Returns transfer ID and code to caller
- Unit tests for validation, code generation, and expiry setting

## Summary of Changes

- Created `apps/api/src/services/device-transfer.service.ts` with `initiateTransfer()` function
- Created `apps/api/src/routes/account/device-transfer.ts` with `POST /` endpoint
- Created `apps/api/src/routes/account/device-transfer.constants.ts` with rate limit and attempt constants
- Mounted route in account routes index as `/device-transfer`
- Added IP-keyed rate limiter for transfer initiation
