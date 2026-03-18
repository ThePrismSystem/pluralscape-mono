---
# api-xupr
title: Deduplicate MAX_ANCESTOR_DEPTH and cycle detection
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:45:00Z
parent: api-i2pw
---

MAX_ANCESTOR_DEPTH defined in groups.constants.ts and inline in subsystem.service.ts. Ancestor-walk cycle detection duplicated in group and subsystem services. Extract to shared helper. Ref: audit P-12, P-14.

## Summary of Changes\n\nMoved MAX_ANCESTOR_DEPTH to service.constants.ts. Created lib/hierarchy.ts with generic detectAncestorCycle() helper. Refactored group.service.ts and subsystem.service.ts to use the shared helper. Removed duplicate constant from subsystem.service.ts and deleted unused groups.constants.ts.
