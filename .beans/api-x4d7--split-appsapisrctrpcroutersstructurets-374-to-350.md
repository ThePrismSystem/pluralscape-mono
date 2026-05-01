---
# api-x4d7
title: Split apps/api/src/trpc/routers/structure.ts (374 to <=350)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:12Z
updated_at: 2026-04-30T22:20:19Z
parent: ps-r5p7
---

## Summary of Changes

Split routers/structure.ts (374 LOC) into apps/api/src/trpc/routers/structure/links.ts using the barrel + spread pattern.
Required prerequisite: extended apps/api/scripts/trpc-parity-lib.ts to recurse into router subdirectories.
Original path remains as barrel composing structureRouter.
