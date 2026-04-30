---
# api-k307
title: Split apps/api-e2e/src/fixtures/entity-helpers.ts (520 to <=400)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:12Z
updated_at: 2026-04-30T21:25:06Z
parent: ps-r5p7
---

## Summary of Changes

Split entity-helpers.ts (520 LOC) into apps/api-e2e/src/fixtures/entity-helpers/{system,member,group,fields,content,structure,admin}.ts using barrel pattern.
Original path remains as a 13-line barrel re-exporting the full public API unchanged.
All 20 exports preserved. typecheck and lint both exit 0.
