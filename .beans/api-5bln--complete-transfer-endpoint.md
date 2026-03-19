---
# api-5bln
title: Complete transfer endpoint
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-19T11:39:42Z
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
