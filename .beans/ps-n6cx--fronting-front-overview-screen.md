---
# ps-n6cx
title: "Fronting: Front overview screen"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T05:50:07Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-5920
blocked_by:
  - ps-udt1
---

## Goal

Design the Fronting front-overview screen: preview HTML covering the active fronters panel, recent switches, and primary quick-switch entry point. This is the primary tab landing surface for the fronting domain.

## Surfaces

- Front overview: `(app)/(tabs)/front/index.tsx` — primary tab destination. Shows currently-fronting members + custom fronts + structure entities, recent switch activity, and the primary quick-switch CTA.

## Required states per surface

- default — single fronter
- default — multiple co-fronters with overlapping time ranges
- default — custom front active alongside members
- default — structure entity fronting
- empty — no one fronting, no fronting history at all
- partial-empty — no one fronting, has prior history
- loading
- error (recoverable)
- offline — last-known state shown with sync indicator

## Mode notes

- Littles mode simplifies hierarchy: larger "Who's fronting?" header, recent switches collapsed to a single summary line.
- High-contrast mode pairs member identity color with shape glyph + initial per GOVERNANCE.md §4.

## Primitives required

- AvatarStack
- FrontingChip
- BottomTabBar
- AppHeader
- EmptyState (constellation variant)
- ScreenScaffold
- PullToRefresh
- BucketPill
- SyncIndicator

If any are not in docs/design-system/preview/ at design time, block on the Phase 0 bean producing them.

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` — activeFronters, list
- `apps/api/src/trpc/routers/analytics.ts` — recent summary

For understanding data shapes only. Not for wiring (M12).

## Required output

- [ ] docs/design-system/preview/fronting-overview.html with all states
- [ ] Brief layout / interaction rationale notes (same file or sibling)

## Out of scope

- React Native code (M11), data wiring (M12), mode variants beyond the structural notes above (Phase 3 sweep).
