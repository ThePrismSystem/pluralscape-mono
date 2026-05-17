---
# ps-awhm
title: "Structure: Structure overview"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:42:19Z
updated_at: 2026-05-17T07:42:04Z
parent: ps-7wf6
blocked_by:
  - ps-5920
---

## Goal

Design the Structure overview screen — landing for system structure with cards for entity-type counts, hierarchy depth, snapshot count, and quick-jump tiles.

## Surfaces

- Structure overview: `(app)/structure/index.tsx`

## Required states per surface

- default (with entity-type counts + recent snapshots), empty (no entity types defined), with-many-entity-types (scrollable), error

## Mode notes

- Littles: simplified — only "Members and groups" entry visible; advanced structure hidden
- High-contrast: per-section card uses border-strong, not surface tint

## Primitives required

- ScreenScaffold, Card (section tile), KeyValueRow (ps-5lr6), Badge, EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/structure.ts` summary
- `apps/api/src/trpc/routers/snapshot.ts` recent

## Required output

- [ ] docs/design-system/preview/structure-overview.html with all states
- [ ] Rationale on what's surfaced vs hidden behind sub-screens

## Out of scope

- RN code (M11), data wiring (M12), individual sub-screens
