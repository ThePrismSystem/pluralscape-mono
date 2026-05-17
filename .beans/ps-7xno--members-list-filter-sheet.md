---
# ps-7xno
title: "Members: List + filter sheet"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:36:20Z
updated_at: 2026-05-17T07:42:02Z
parent: ps-07l7
blocked_by:
  - ps-5920
---

## Goal

Design the Members list — primary tab destination — and its filter sheet (by tag, by group, by saturation, by archived state, by bucket).

## Surfaces

- Members list: `(app)/(tabs)/members/index.tsx`
- Filter sheet: `(modals)/member-filter.tsx`

## Required states per surface

- list: empty system (no members ever), small system (1–3 members), large system (search-required), with-archived-toggle, with-filter-chips active, loading, error
- filter: idle, filters applied, reset

## Mode notes

- Littles: simplified — alphabetical grid only, no advanced filters
- High-contrast: member identity rows pair color + shape + initial (GOVERNANCE.md §4)

## Primitives required

- ScreenScaffold, AppHeader, FAB (add new), InfiniteList (ps-hijf), MemberCard, Chip (filter), EmptyState (ps-ruwi), BottomSheet (filter host), TagPicker (ps-jleu) inline, MultiMemberPicker (ps-djqo, for group filter), BucketPicker (ps-s9r6, for bucket filter)

## Data refs (informational)

- `apps/api/src/trpc/routers/member.ts` list with filters

## Required output

- [ ] docs/design-system/preview/members-list-filter.html with all states
- [ ] Rationale on which filters are surfaced inline vs deep in the sheet

## Out of scope

- RN code (M11), data wiring (M12), member detail (separate bean)
