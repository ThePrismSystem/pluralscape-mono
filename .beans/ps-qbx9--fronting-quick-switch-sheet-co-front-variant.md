---
# ps-qbx9
title: "Fronting: Quick switch sheet + co-front variant"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T05:50:12Z
updated_at: 2026-05-17T07:42:07Z
parent: ps-5920
blocked_by:
  - ps-udt1
---

## Goal

Design the quick-switch sheet: the primary action UI for ending the current fronting session and starting a new one, or adding a co-fronter alongside.

## Surfaces

- Quick switch: `(sheets)/quick-switch.tsx` — invoked from front-overview, member list, and header chip.
- Co-front add: same sheet with an "Add alongside" toggle (`endPrevious=false`).

## Required states per surface

- idle — member list visible, no selection
- selecting — member chosen, status text input visible
- co-front toggle on
- bucket selection visible (assign privacy bucket to the new session)
- confirming — submit engaged
- optimistic-update — sheet dismissing, fronting state already shows new fronter
- error — offline → queued, with retry affordance

## Mode notes

- Littles mode: larger member tiles, "Add alongside" toggle hidden by default (single-action).
- Static mode: removes gradient/glow on member tiles.

## Primitives required

- BottomSheet (host)
- MemberCard (selection)
- MultiMemberPicker (when adding co-fronters)
- TextField (status text — 50 char cap per features.md §2)
- Switch (co-front toggle, positionality flag)
- Button
- BucketPicker
- Banner (offline notice)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` — start, co-front, structure-entity-front

## Required output

- [ ] docs/design-system/preview/fronting-quick-switch.html with all states
- [ ] Layout / interaction rationale

## Out of scope

- RN code (M11), data wiring (M12), mode coverage variants (Phase 3 sweep).
