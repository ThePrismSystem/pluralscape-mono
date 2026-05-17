---
# ps-uck1
title: "Home: System switcher modal"
status: todo
type: feature
created_at: 2026-05-17T06:35:24Z
updated_at: 2026-05-17T06:35:24Z
parent: ps-divy
---

## Goal

Design the System switcher modal surface that wraps the SystemSwitcher primitive (ps-a5pt). Invoked from the AppHeader system-name tap.

## Surfaces

- System switcher: `(modals)/system-switcher.tsx`

## Required states per surface

- default (current system highlighted), single-system (no switcher needed — surface disabled or "Add system" CTA only), many-systems with search, currently-syncing transition

## Mode notes

- Littles: hidden if account has multiple systems with adult content (parent / caregiver setting)
- High-contrast: current-system indicator uses both color AND label/icon

## Primitives required

- BottomSheet (mobile host), Dialog (web host ≥1024px), SystemSwitcher primitive (ps-a5pt), Button (+ Add system)

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` system list (returns `SystemListItem[]`)

## Required output

- [ ] docs/design-system/preview/home-system-switcher.html with all states
- [ ] Rationale on transition affordance (instant vs slow)

## Out of scope

- RN code (M11), data wiring (M12), the create-new-system flow (separate Auth or settings bean)
