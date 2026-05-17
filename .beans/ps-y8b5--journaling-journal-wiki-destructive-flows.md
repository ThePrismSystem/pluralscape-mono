---
# ps-y8b5
title: "Journaling: Journal + wiki destructive flows"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:44:55Z
updated_at: 2026-05-17T07:42:09Z
parent: ps-djgs
blocked_by:
  - ps-5920
---

## Goal

Design the archive + delete confirms for journal entries and wiki pages.

## Surfaces

- Journal entry archive confirm
- Journal entry delete confirm
- Wiki page archive confirm
- Wiki page delete confirm (multi-author warning if applicable)

## Required states per surface

- archive: warning + ack, submitting, success, undo-toast affordance
- delete: warning, typed-confirm, multi-author-confirmation (require co-author sign-off for multi-author wiki pages — optional design exploration), submitting, success-redirect-to-list

## Mode notes

- Littles: delete hidden entirely
- High-contrast: destructive states use icon + label

## Primitives required

- Dialog or BottomSheet (host), DestructiveConfirmDialog (ps-bydy), TextField (typed-confirm), Banner, Button, Toast (undo affordance after archive), AvatarStack (co-authors)

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` archive, restore, delete (entries + wiki)

## Required output

- [ ] docs/design-system/preview/journal-destructive.html with all flows + states
- [ ] Open question to resolve: co-author sign-off for wiki page deletion — yes / no

## Out of scope

- RN code (M11), data wiring (M12)
