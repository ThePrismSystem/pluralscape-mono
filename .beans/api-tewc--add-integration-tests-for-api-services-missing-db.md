---
# api-tewc
title: Add integration tests for API services missing DB coverage
status: completed
type: task
priority: high
created_at: 2026-04-14T09:29:22Z
updated_at: 2026-04-16T06:35:33Z
parent: ps-ai5y
---

AUDIT [API-TC-H4,H5] relationship.service.ts, system-purge/duplicate, all 5 structure-entity services have unit tests but no integration tests hitting real DB. Graph traversal, privacy-bucket intersection, CASCADE deletes untested at I/O boundary.

## Summary of Changes

Added integration tests for relationship, system-purge, system-duplicate, and structure-entity-crud services hitting real DB via PGlite.
