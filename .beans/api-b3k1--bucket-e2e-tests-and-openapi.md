---
# api-b3k1
title: Bucket E2E tests and OpenAPI
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:31Z
updated_at: 2026-03-26T20:25:36Z
parent: api-e3hk
blocked_by:
  - api-b2zz
  - api-fc7h
  - api-9e56
---

E2E tests covering full bucket CRUD lifecycle, content tagging, and field visibility. Test scenarios: create bucket with valid/invalid data, update bucket name and description, archive and restore bucket, delete bucket (expect 409 when dependents exist), tag and untag content across entity types, set and remove field bucket visibility, list buckets with pagination, verify archived buckets excluded from default list, non-owner receives 404. OpenAPI spec additions for all bucket endpoints. Files: apps/api-e2e/src/tests/buckets/crud.spec.ts (new), apps/api-e2e/src/tests/buckets/tags.spec.ts (new), apps/api-e2e/src/tests/buckets/field-visibility.spec.ts (new).

## Summary of Changes

Created E2E tests: crud.spec.ts (full lifecycle, error paths), tags.spec.ts (tag/untag, idempotency, entityType validation), field-visibility.spec.ts (set/list/remove lifecycle, idempotency). Added createBucket helper to entity-helpers.ts. OpenAPI spec updates deferred to a follow-up bean.
