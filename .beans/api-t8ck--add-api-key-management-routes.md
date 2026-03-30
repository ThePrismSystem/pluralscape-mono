---
# api-t8ck
title: Add API key management routes
status: completed
type: feature
priority: critical
created_at: 2026-03-29T21:31:09Z
updated_at: 2026-03-30T00:15:25Z
parent: api-e7gt
---

No /api-keys route group exists. Requirements F§9 and ADR-013 specify: create metadata key, create crypto key, list keys, revoke key, scoped access, key lifecycle dashboard. Entire subsystem is absent.

Audit ref: Domain 15, gap 3

## Summary of Changes

- Created `api-key.service.ts` with create, list, get, revoke operations
- Token: 32 random bytes hex, SHA-256 hash stored, plaintext only on create response
- Created 5 route handlers under `routes/api-keys/`
- Mounted at `/:systemId/api-keys` in systems routes
- Added `CreateApiKeyBodySchema` to validation package
- Added audit events: api-key.created, api-key.revoked
- Idempotent revoke (already-revoked returns success)
- 7 unit tests for route handlers
