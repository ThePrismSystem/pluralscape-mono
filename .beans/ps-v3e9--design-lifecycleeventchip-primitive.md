---
# ps-v3e9
title: Design LifecycleEventChip primitive
status: todo
type: task
created_at: 2026-05-17T06:29:18Z
updated_at: 2026-05-17T06:29:18Z
parent: ps-udt1
---

## Goal

Design the LifecycleEventChip primitive: per-event-type icon + label chip used in member detail lifecycle tabs and the global lifecycle log. Event types per features.md §6: split, fusion, merge, unmerge, dormancy-start, dormancy-end, discovery, archival, structure-formation, form-change, name-change, structure-move, innerworld-move.

## Required output

- [ ] `docs/design-system/preview/components-lifecycle-chip.html` showing all 13 event-type variants with their distinct iconography + label + tone
- [ ] Spec doc per SKILL.md §8 (color is not the only signal — every chip pairs icon + label per GOVERNANCE.md a11y rules)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §6 lifecycle event list, `apps/api/src/trpc/routers/lifecycle-event.ts`

## Out of scope

- RN code (M11), screen-level integration (Member management beans)
