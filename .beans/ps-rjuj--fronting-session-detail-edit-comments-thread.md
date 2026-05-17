---
# ps-rjuj
title: "Fronting: Session detail + edit + comments thread"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T05:50:25Z
updated_at: 2026-05-17T07:42:08Z
parent: ps-5920
blocked_by:
  - ps-udt1
---

## Goal

Design the fronting session detail screen, its edit form, and the inline comments thread.

## Surfaces

- Session detail: `(app)/fronting/[sessionId]/index.tsx` — view single session, comments thread, lifecycle metadata.
- Session edit: `(app)/fronting/[sessionId]/edit.tsx` — retroactive edit (time range, members, status text, positionality, outtrigger reason + sentiment).
- Comments thread: inline within detail (not a separate route).

## Required states per surface

- detail: active session (no end_at), ended, archived, with comments, without comments, multi-member (co-fronting), loading, error
- edit: form valid, form invalid (e.g. end before start), submitting, conflict (concurrent edit), success
- comments: empty thread, populated thread, compose-new, editing-existing, delete confirm

## Mode notes

- Outtrigger sentiment editing (negative / neutral / positive) must not be color-only — include icon + label per GOVERNANCE.md §4.
- Littles mode: hide outtrigger editing (sensitive content per GOVERNANCE.md §3.3); show comments simplified.

## Primitives required

- ScreenScaffold
- KeyValueRow (lifecycle metadata)
- AvatarStack
- TextArea (status text, comment compose)
- DateTimePicker (time range edit)
- SegmentedControl (outtrigger sentiment)
- Banner (offline notice, edit conflict notice)
- Dialog (delete confirm — DestructiveConfirmDialog variant)
- ListItem (comment row)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` — get, update, delete
- `apps/api/src/trpc/routers/fronting-comment.ts` — list, create, update, delete

## Required output

- [ ] docs/design-system/preview/fronting-session-detail.html with all surfaces and states
- [ ] Layout / interaction rationale

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond structural notes (Phase 3 sweep).
