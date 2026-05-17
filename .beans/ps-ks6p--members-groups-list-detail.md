---
# ps-ks6p
title: "Members: Groups — list + detail"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:37:25Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-07l7
blocked_by:
  - ps-5920
---

## Goal

Design the Groups list and group detail screens. Groups are hierarchical with multi-group membership; the detail screen shows members + sub-groups + group-level custom fields.

## Surfaces

- Group list: `(app)/groups/index.tsx`
- Group detail: `(app)/groups/[groupId]/index.tsx`

## Required states per surface

- list: empty, populated (flat), populated (nested with expand/collapse), archived view, with-reorder-mode toggle, error
- detail: default with members + sub-groups, empty (no members yet), archived, with custom-fields section

## Mode notes

- Littles: nested groups flattened (single level shown)
- High-contrast: group color tile pairs color + emoji (not color-only)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, Card (group tile), Accordion (ps-ecpl, for nesting), MemberCard, EmptyState (ps-ruwi), BucketPill (ps-i6n1) for visibility, ColorStrip
- Tree primitive (existing in components-rows-tree.html) for nested groups

## Data refs (informational)

- `apps/api/src/trpc/routers/group.ts` list, get, byParent
- `apps/api/src/trpc/routers/field.ts` valuesForGroup

## Required output

- [ ] docs/design-system/preview/members-groups-list-detail.html with all states
- [ ] Rationale on nested group visualization (tree vs accordion)

## Out of scope

- RN code (M11), data wiring (M12), create / edit / move / member-add flows (separate bean)
