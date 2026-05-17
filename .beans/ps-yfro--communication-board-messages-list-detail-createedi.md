---
# ps-yfro
title: "Communication: Board messages (list + detail + create/edit)"
status: todo
type: feature
created_at: 2026-05-17T06:39:01Z
updated_at: 2026-05-17T06:39:01Z
parent: ps-5fc5
---

## Goal

Design the Board messages surfaces — persistent noticeboard with pin/unpin, drag-and-drop reorder, polymorphic authorship.

## Surfaces

- Board list: `(app)/communicate/board/index.tsx`
- Board detail: `(app)/communicate/board/[id].tsx`
- New: `(app)/communicate/board/new.tsx`
- Edit: `(app)/communicate/board/[id]/edit.tsx`

## Required states per surface

- list: empty, populated, with-pinned-section, reorder mode active, archived view, with-filter chips, error
- detail: default, with-archive-banner, edit affordance for owner
- create/edit: empty/populated, with-rich-text composer, with-bucket-picker, with-pin toggle, submitting, conflict

## Mode notes

- Littles: pin/unpin hidden (caregiver-only); reorder uses up/down arrows instead of drag
- High-contrast: pin indicator uses icon + "Pinned" text label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (board-message tile), Badge (pinned), FAB, RichTextField (ps-9yhh), BucketPicker (ps-s9r6), ProxyChip (ps-jtvw), EmptyState (ps-ruwi), DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- `apps/api/src/trpc/routers/board-message.ts` list, get, create, update, archive, delete, pin, reorder

## Required output

- [ ] docs/design-system/preview/comm-board.html with all surfaces + states
- [ ] Rationale on pinned-section vs sticky-row treatment

## Out of scope

- RN code (M11), data wiring (M12)
