---
# ps-5iro
title: Design InnerworldNode primitive
status: todo
type: task
created_at: 2026-05-17T06:29:42Z
updated_at: 2026-05-17T06:29:42Z
parent: ps-udt1
---

## Goal

Design the InnerworldNode primitive: canvas node placed on the Innerworld 2D canvas. Three variants — member, landmark, structure-entity — each with visual properties (color, shape, image source, external URL).

## Required output

- [ ] `docs/design-system/preview/components-innerworld-node.html` showing the 3 variants (member, landmark, structure-entity) with each visual property type (color-only, image, external-url) and required states (idle, selected, dragging, editing-meta-popover-open)
- [ ] Spec doc per SKILL.md §8 (drag-to-reposition gesture, snap-to-grid optional, accessibility: keyboard arrow keys reposition by 1px increments)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/radii.json`, `tokens/motion.json`
- Reference: features.md §6 innerworld mapping, `apps/api/src/trpc/routers/innerworld.ts`

## Out of scope

- RN code (M11), screen-level integration (System structure beans), the canvas pan/zoom chrome (separate Innerworld canvas screen bean)
