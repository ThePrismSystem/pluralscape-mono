---
# ps-d5bg
title: "Fronting: Timer configs — list + create/edit"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T05:51:05Z
updated_at: 2026-05-17T07:42:04Z
parent: ps-5920
blocked_by:
  - ps-udt1
---

## Goal

Design the dissociation check-in timer configuration screens.

## Surfaces

- Timer config list: `(app)/timers/index.tsx`
- Timer config create/edit: `(app)/timers/new.tsx`, `[id]/edit.tsx` — interval, waking-hours window, member scope, notification preferences.

## Required states per surface

- list: empty, populated, archived view (separate filter)
- config form: valid, invalid (e.g. interval too short), submitting, conflict

## Mode notes

- Waking-hours picker must support both 12h and 24h locale formats — design both.
- Littles mode: hides "waking hours" complexity (single all-day interval option only).

## Primitives required

- ListItem
- FAB
- DurationPicker (interval: every N minutes / hours)
- TimePicker (waking-hours start / end)
- Switch (enable/disable, notification toggle)
- MultiMemberPicker (member scope — which members get the check-in)
- EmptyState

## Data refs (informational)

- `apps/api/src/trpc/routers/timer-config.ts` — list, get, create, update, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/fronting-timers.html with all states
- [ ] Layout / interaction rationale

## Out of scope

- RN code (M11), data wiring (M12), mode coverage (Phase 3 sweep), actual check-in prompt UI (separate bean D9).
