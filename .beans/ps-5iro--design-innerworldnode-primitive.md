---
# ps-5iro
title: Design InnerworldNode primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:29:42Z
updated_at: 2026-05-17T19:06:46Z
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

## Entity-type variants (2026-05-17)

The audit's variant list (member / region / place / custom) was wrong.
`InnerWorldEntityType` from
`packages/types/src/entities/innerworld-entity.ts` has exactly three
variants:

- `member` — represents a system member's presence in the innerworld
  (composes the member's avatar + display name)
- `landmark` — a named location or fixture in the innerworld (a free
  user-named node with description)
- `structure-entity` — linked to a system structure entity (composes
  the structure entity's name + visual properties)

InnerworldRegions are a separate entity — they're containing zones, not
nodes — and live in their own primitive (out of scope here).

Sizes (sm / md / lg), states (default, selected, dragging, dimmed) and
mode coverage per SKILL.md. Connection-point hit areas on the node
boundary feed RelationshipEdge (ps-jtn3) wiring.
