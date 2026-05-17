---
# ps-nsth
title: "Home: Home dashboard"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:35:11Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-divy
blocked_by:
  - ps-5920
---

## Goal

Design the Home dashboard — the landing surface after auth. Composes active-fronters widget, recent activity feed, sync state, quick actions, optional check-in prompt slot.

## Surfaces

- Home dashboard: `(app)/(tabs)/index.tsx`

## Required states per surface

- default (active fronters present + recent activity)
- empty (no one fronting + no activity ever)
- partial-empty (no current activity but has history)
- check-in pending (CheckInPrompt slot active)
- offline (last-known with sync indicator)
- loading (skeleton)
- error

## Mode notes

- Littles: simplified — single "Who's fronting?" header + single primary action; activity feed hidden
- High-contrast: widgets use boundary contrast not surface tint
- Static: no shimmer / drift on empty-state constellation

## Primitives required

- ScreenScaffold, AvatarStack, FrontingChip (ps-458i), CheckInPrompt (ps-7to1), EmptyState (ps-ruwi), Card, SyncIndicator (ps-gnkq), Button (quick actions), InfiniteList (ps-hijf, for activity feed)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` activeFronters
- `apps/api/src/trpc/routers/lifecycle-event.ts` recent
- `apps/api/src/trpc/routers/check-in-record.ts` pending

## Required output

- [ ] docs/design-system/preview/home-dashboard.html with all states
- [ ] Rationale on what gets surfaced vs hidden, with Littles-mode reasoning

## Out of scope

- RN code (M11), data wiring (M12), individual widget detail screens (separate beans)
