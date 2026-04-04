---
# ps-rjpa
title: Inner world hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:12:34Z
updated_at: 2026-04-04T10:27:32Z
parent: ps-yspo
---

Entities, regions, canvas state

Uses trpc.innerworld.\* for entities, regions, and canvas state.

## Summary of Changes

Implemented 3 hook files with transforms and tests:

- use-innerworld-entities.ts (encrypted CRUD, discriminated union, 7 hooks)
- use-innerworld-regions.ts (encrypted CRUD, 7 hooks)
- use-innerworld-canvas.ts (encrypted singleton, 2 hooks)

3 transforms: innerworld-entity, innerworld-region, innerworld-canvas
3 test files with 27 tests total
