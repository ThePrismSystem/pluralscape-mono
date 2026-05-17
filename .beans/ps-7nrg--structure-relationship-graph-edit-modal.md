---
# ps-7nrg
title: "Structure: Relationship graph + edit modal"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:43:03Z
updated_at: 2026-05-17T07:42:02Z
parent: ps-7wf6
blocked_by:
  - ps-5920
---

## Goal

Design the relationship graph view — member-to-member typed edges visualized as a pan/zoom canvas — plus the inline relationship create / edit modal.

## Surfaces

- Graph: `(app)/structure/relationships/index.tsx`
- Edit modal: `(modals)/relationship-edit.tsx`

## Required states per surface

- graph: empty (no relationships), small graph (3-10 nodes), large graph (with-clustering), with-filter-by-type chip, with-selected-edge highlighted, error
- edit: pick relationship-type, pick endpoints (member A + member B), bidirectional toggle, submitting, success

## Mode notes

- Littles: hidden
- High-contrast: graph edges use both color and pattern (dashed for one direction, solid for bidirectional)
- Reduced-motion: pan / zoom transitions clamped

## Primitives required

- ScreenScaffold, Canvas primitive (or wrapper), RelationshipEdge (ps-jtn3), Avatar (nodes), Chip (filter), BottomSheet (edit host), RelationshipTypePicker (ps-1v9l), MemberPicker (ps-djqo), Switch (bidirectional), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/relationship.ts` list, create, update, delete

## Required output

- [ ] docs/design-system/preview/structure-relationships.html with all surfaces + states
- [ ] Rationale on graph layout algorithm (force-directed vs radial vs circular)

## Out of scope

- RN code (M11), data wiring (M12), the RelationshipEdge primitive (Phase 0)
