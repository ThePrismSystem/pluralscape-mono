---
# ps-l83m
title: "Members: Lifecycle events (detail + create + global log)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:38:00Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-07l7
blocked_by:
  - ps-5920
---

## Goal

Design the lifecycle event surfaces — detail view per event, create modal, and the global log spanning all members.

## Surfaces

- Event detail: `(app)/lifecycle/[eventId].tsx`
- Event create: `(modals)/lifecycle-create.tsx`
- Global log: `(app)/lifecycle/index.tsx`

## Required states per surface

- detail: per-event-type rendering (split, fusion, merge, unmerge, dormancy-start/end, discovery, archival, structure-formation, form-change, name-change, structure-move, innerworld-move), archived, edit affordance
- create: pick-event-type, per-type form (e.g. split needs source-member + resulting-members; merge needs participating-members), submitting, validation-error
- global log: empty, populated, filtered (by-member, by-type, by-date-range), archived view, error, loading

## Mode notes

- Littles: lifecycle log hidden by default (sensitive content per GOVERNANCE.md §3.3); create flow hidden
- High-contrast: per-type chip uses icon + label (color is supplemental)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), LifecycleEventChip (ps-v3e9), KeyValueRow (ps-5lr6), MultiMemberPicker (ps-djqo), Select (event-type pick), TextArea (note), DateTimePicker, EmptyState (ps-ruwi), Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/lifecycle-event.ts` list, get, create, update, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/members-lifecycle.html with all surfaces + states
- [ ] Rationale on per-event-type form rendering (single-form-with-conditional-fields vs per-type-screen)

## Out of scope

- RN code (M11), data wiring (M12), per-member lifecycle tab (covered by Members detail bean)
