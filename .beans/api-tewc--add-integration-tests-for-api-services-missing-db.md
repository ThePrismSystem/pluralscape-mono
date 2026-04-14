---
# api-tewc
title: Add integration tests for API services missing DB coverage
status: todo
type: task
priority: high
created_at: 2026-04-14T09:29:22Z
updated_at: 2026-04-14T09:29:22Z
---

AUDIT [API-TC-H4,H5] relationship.service.ts, system-purge/duplicate, all 5 structure-entity services have unit tests but no integration tests hitting real DB. Graph traversal, privacy-bucket intersection, CASCADE deletes untested at I/O boundary.
