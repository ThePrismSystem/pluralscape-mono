---
# api-b3k1
title: Bucket E2E tests and OpenAPI
status: todo
type: feature
created_at: 2026-03-26T16:03:31Z
updated_at: 2026-03-26T16:03:31Z
parent: api-e3hk
blocked_by:
  - api-b2zz
  - api-fc7h
  - api-9e56
---

E2E tests covering full bucket CRUD lifecycle, content tagging, and field visibility. Test scenarios: create bucket with valid/invalid data, update bucket name and description, archive and restore bucket, delete bucket (expect 409 when dependents exist), tag and untag content across entity types, set and remove field bucket visibility, list buckets with pagination, verify archived buckets excluded from default list, non-owner receives 404. OpenAPI spec additions for all bucket endpoints. Files: apps/api-e2e/src/tests/buckets/crud.spec.ts (new), apps/api-e2e/src/tests/buckets/tags.spec.ts (new), apps/api-e2e/src/tests/buckets/field-visibility.spec.ts (new).
