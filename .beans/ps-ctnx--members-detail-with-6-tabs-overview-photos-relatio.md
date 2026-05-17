---
# ps-ctnx
title: "Members: Detail with 6 tabs (overview / photos / relationships / fields / groups / lifecycle)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:36:34Z
updated_at: 2026-05-17T07:42:04Z
parent: ps-07l7
blocked_by:
  - ps-5920
---

## Goal

Design the member detail screen with 6 tabbed sub-views. Tabs share a scaffold: header (avatar + name + pronouns + tags), tab bar, content. The 6 tabs are: overview (description, color, custom front status, structure entity membership), photos (gallery), relationships (graph edges to other members), fields (custom-field values), groups (group memberships), lifecycle (event log filtered to this member).

## Surfaces

- Member detail: `(app)/members/[memberId]/index.tsx` (overview, default tab)
- Photos: `(app)/members/[memberId]/photos.tsx`
- Relationships: `(app)/members/[memberId]/relationships.tsx`
- Fields: `(app)/members/[memberId]/fields.tsx`
- Groups: `(app)/members/[memberId]/groups.tsx`
- Lifecycle: `(app)/members/[memberId]/lifecycle.tsx`

## Required states per surface

- header: default, archived, currently-fronting (badge), with-saturation-level
- overview: rich description with member-link previews, color swatch, tags
- photos: gallery (1, multi, empty), upload-pending, error
- relationships: list of edges + visual mini-graph; empty
- fields: ordered field-value list, empty if none defined
- groups: list of group memberships, empty
- lifecycle: timeline of events, empty

## Mode notes

- Littles: photos tab hidden if any contain trauma-marker content (per system setting); lifecycle simplified to last-N events
- High-contrast: tabs use underline indicator (not background-fill)

## Primitives required

- ScreenScaffold, Avatar, Tabs (existing), KeyValueRow (ps-5lr6), BucketPill (ps-i6n1), LifecycleEventChip (ps-v3e9), Accordion (ps-ecpl), MarkdownRenderer, MentionRenderer, RelationshipEdge (ps-jtn3), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/member.ts` get
- `apps/api/src/trpc/routers/member-photo.ts` list
- `apps/api/src/trpc/routers/relationship.ts` byMember
- `apps/api/src/trpc/routers/field.ts` valuesForMember
- `apps/api/src/trpc/routers/group.ts` byMember
- `apps/api/src/trpc/routers/lifecycle-event.ts` byMember

## Required output

- [ ] docs/design-system/preview/members-detail-tabs.html with all 6 tabs + their states
- [ ] Rationale on tab order and which gets primary action button (header right slot)

## Out of scope

- RN code (M11), data wiring (M12), edit form (separate bean), photo gallery management modal (separate bean)
