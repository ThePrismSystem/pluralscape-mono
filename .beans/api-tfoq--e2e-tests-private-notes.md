---
# api-tfoq
title: "E2E tests: private notes"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T15:16:40Z
parent: api-i16z
blocked_by:
  - api-o9vn
---

apps/api-e2e/src/tests/notes/crud.spec.ts — CRUD lifecycle, member-bound vs structure-entity-bound vs system-wide, archive/restore/delete. Cover: auth, error responses, author filtering.

## Summary of Changes

Created `apps/api-e2e/src/tests/notes/crud.spec.ts` with comprehensive E2E tests covering: full CRUD lifecycle, member-authored notes with filtering (authorEntityType, authorEntityId, systemWide), OCC conflict (409), archive/restore idempotency, and 404 cases.
