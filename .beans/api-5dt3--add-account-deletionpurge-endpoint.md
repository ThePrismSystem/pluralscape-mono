---
# api-5dt3
title: Add account deletion/purge endpoint
status: completed
type: feature
priority: critical
created_at: 2026-03-29T21:31:08Z
updated_at: 2026-03-30T00:15:25Z
parent: api-e7gt
---

No DELETE /account or equivalent purge route exists. GDPR requires account deletion capability. Should cascade through all owned systems and data.

Audit ref: Domain 2, gap 1

## Summary of Changes

- Created `account-deletion.service.ts` with password-verified account deletion
- Created `DELETE /account` route handler returning 204
- Added `DeleteAccountBodySchema` to validation package
- Audit event written before CASCADE delete
- Sessions revoked before account deletion
- 2 unit tests for the route handler
