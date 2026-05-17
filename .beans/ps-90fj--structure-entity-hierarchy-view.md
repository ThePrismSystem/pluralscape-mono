---
# ps-90fj
title: "Structure: Entity hierarchy view"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:42:33Z
updated_at: 2026-05-17T07:42:03Z
parent: ps-7wf6
blocked_by:
  - ps-5920
---

## Goal

Design the recursive entity hierarchy view — entities-within-entities, depth-capped at 50 levels per features.md §6. Tree visualization with expand / collapse + per-row entity-detail entry.

## Surfaces

- Entity hierarchy: `(app)/structure/entities/index.tsx`

## Required states per surface

- empty (no entities), shallow tree (1-2 levels), deep tree (collapsed), with-search-filter, with-archived-toggle, error

## Mode notes

- Littles: hidden
- High-contrast: tree connector lines use border-strong + label per row

## Primitives required

- ScreenScaffold, Tree (existing in components-rows-tree.html), Accordion (ps-ecpl, alternate render), FAB, Card (entity row), Icon, Badge, EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/structure.ts` entities + hierarchy

## Required output

- [ ] docs/design-system/preview/structure-hierarchy.html with all states
- [ ] Rationale on tree-vs-accordion render at depth ≥3

## Out of scope

- RN code (M11), data wiring (M12), entity detail / create (separate beans)
