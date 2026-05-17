---
# ps-pgrq
title: "Structure: Entity detail (3 tabs — members / associations / fields)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:42:42Z
updated_at: 2026-05-17T07:42:07Z
parent: ps-7wf6
blocked_by:
  - ps-5920
---

## Goal

Design the structure entity detail screen with 3 tabbed sub-views.

## Surfaces

- Entity detail: `(app)/structure/entities/[entityId]/index.tsx` (members, default)
- Members tab: same path
- Associations tab: `(app)/structure/entities/[entityId]/associations.tsx`
- Fields tab: `(app)/structure/entities/[entityId]/fields.tsx`

## Required states per surface

- header: default (with type tag, parent chain breadcrumb, color, gatekeeper indicator)
- members: empty, populated, with-add affordance
- associations: empty, with-incoming edges, with-outgoing edges, with-create affordance
- fields: scoped custom-field values, empty if no field defs scoped to this entity-type

## Mode notes

- Littles: hidden
- High-contrast: tabs use underline indicator (not background-fill)

## Primitives required

- ScreenScaffold, Tabs (existing), Badge (entity-type), MemberCard, RelationshipEdge (ps-jtn3), KeyValueRow (ps-5lr6), EntityRefPicker (ps-ywtb, for association create), MultiMemberPicker (ps-djqo), EmptyState (ps-ruwi), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/structure.ts` entity get, memberLinks, associations, fields-for-entity

## Required output

- [ ] docs/design-system/preview/structure-entity-detail.html with all 3 tabs + states
- [ ] Rationale on parent-chain breadcrumb format

## Out of scope

- RN code (M11), data wiring (M12), create / edit form (separate bean)
