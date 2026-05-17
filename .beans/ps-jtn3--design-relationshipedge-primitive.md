---
# ps-jtn3
title: Design RelationshipEdge primitive
status: todo
type: task
created_at: 2026-05-17T06:29:36Z
updated_at: 2026-05-17T06:29:36Z
parent: ps-udt1
---

## Goal

Design the RelationshipEdge primitive: visual edge for the System structure relationship graph view. Carries a type label (split-from, fused-from, sibling, partner, parent-child, protector-of, caretaker-of, gatekeeper-of, source, custom) and a direction indicator (or bidirectional). Hover/long-press surfaces relationship metadata.

## Required output

- [ ] `docs/design-system/preview/components-relationship-edge.html` showing variants (directional, bidirectional, custom-type, with-metadata-popover-open) and required states
- [ ] Spec doc per SKILL.md §8 (a11y: edges must be reachable in tab order; metadata available via popover)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/typography.json`
- Reference: features.md §6, `apps/api/src/trpc/routers/relationship.ts`

## Out of scope

- RN code (M11), screen-level integration (System structure beans)
