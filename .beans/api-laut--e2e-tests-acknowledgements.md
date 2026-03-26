---
# api-laut
title: "E2E tests: acknowledgements"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:38:53Z
parent: api-vjmu
blocked_by:
  - api-6ft8
---

apps/api-e2e/src/tests/acknowledgements/crud.spec.ts — Create, confirm, list pending, archive/delete. Cover: cooperative enforcement (trust-based, not cryptographic), auth, error responses.

## Summary of Changes\n\nCreated E2E test at `apps/api-e2e/src/tests/acknowledgements/crud.spec.ts` covering full lifecycle (create, get, encryption round-trip, list, pending/confirmed filters, confirm, idempotent re-confirm, archive, includeArchived, restore, delete, 404 on deleted) and cross-system access. Added `createAcknowledgement` entity helper. Fixed audit event type CHECK constraint in DB enums.
