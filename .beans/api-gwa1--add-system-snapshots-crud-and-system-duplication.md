---
# api-gwa1
title: Add system snapshots CRUD and system duplication
status: completed
type: feature
priority: high
created_at: 2026-03-29T21:31:25Z
updated_at: 2026-03-30T01:01:46Z
parent: api-e7gt
---

Both features are specified in features.md and ADR-022 but marked as deferred in milestones.md:

1. System snapshots — no CRUD routes (create/list/get/delete) under /systems/:id/snapshots
2. System duplication — no POST /systems/:id/duplicate endpoint for deep copy

Audit ref: Domain 3, gaps 1-2

## Summary of Changes\n\n- Created snapshot.service.ts with create/list/get/delete\n- Created system-duplicate.service.ts for POST /:id/duplicate\n- Created routes/systems/snapshots/ and duplicate.ts\n- Added validation schemas\n- systemSnapshots table already existed\n- 12 unit tests
