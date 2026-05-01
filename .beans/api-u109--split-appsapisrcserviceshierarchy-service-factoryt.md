---
# api-u109
title: Split apps/api/src/services/hierarchy-service-factory.ts (501 to <=450)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:12Z
updated_at: 2026-04-30T21:45:08Z
parent: ps-r5p7
---

## Summary of Changes

Split hierarchy-service-factory.ts (501 LOC) into hierarchy-service-factory/{create-op,query-ops,update-op,remove-op,restore-op,factory}.ts barrel pattern.
Original path remains as 7-LOC barrel re-exporting createHierarchyService.
All resulting files: 95-133 LOC each, well under 450 ceiling.
Typecheck, lint (zero warnings), and all 5245 tests pass.
