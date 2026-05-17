---
# ps-f0qp
title: "Fronting: Check-ins — prompt modal + history + detail"
status: todo
type: feature
created_at: 2026-05-17T05:51:18Z
updated_at: 2026-05-17T05:51:18Z
parent: ps-5920
---

## Goal

Design the dissociation check-in surfaces: the prompt modal that fires from a timer, the history list of past check-ins, and the single-record detail view.

## Surfaces

- Check-in prompt: `(modals)/check-in.tsx` — modal that surfaces when a timer fires; respond / dismiss / archive.
- History list: `(app)/check-ins/index.tsx` — past check-ins with response state.
- Record detail: `(app)/check-ins/[id].tsx` — single check-in view.

## Required states per surface

- prompt: idle (initial), responding (compose answer), dismissing, archiving, error
- history: empty, populated, mixed response states (responded / dismissed / unresponded)
- detail: responded, dismissed, archived, error

## Mode notes

- Critical UX surface for dissociation context: gentle copy, never punitive (per GOVERNANCE.md §7 voice rules).
- Littles mode: hide "dismiss" action by default; reframe as "I'm OK, ask me later".
- Static mode: prompt appears instantly (no slide-up animation). Reduced-motion: 50ms fade instead.

## Primitives required

- CheckInPrompt (Phase 0 must produce — domain primitive; block on it)
- Dialog or BottomSheet (prompt host)
- TextArea (response compose)
- ListItem (history rows)
- KeyValueRow (detail metadata)
- EmptyState
- Banner (offline notice — response queued)

## Data refs (informational)

- `apps/api/src/trpc/routers/check-in-record.ts` — list, get, create (from timer fire), respond, dismiss, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/fronting-checkins.html with all surfaces and states
- [ ] Copy decisions (prompt question variants, response affordances) per GOVERNANCE.md §7

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond structural notes (Phase 3 sweep).
