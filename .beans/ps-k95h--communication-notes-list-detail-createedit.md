---
# ps-k95h
title: "Communication: Notes (list + detail + create/edit)"
status: todo
type: feature
created_at: 2026-05-17T06:39:15Z
updated_at: 2026-05-17T06:39:15Z
parent: ps-5fc5
---

## Goal

Design the private notes surfaces — member-bound or system-wide notes with rich text, custom background colors, polymorphic authorship.

## Surfaces

- Note list: `(app)/communicate/notes/index.tsx`
- Note detail: `(app)/communicate/notes/[id].tsx`
- New: `(app)/communicate/notes/new.tsx`
- Edit: `(app)/communicate/notes/[id]/edit.tsx`

## Required states per surface

- list: empty, populated (grid of color-cards), filtered by-member or system-wide, archived view, error
- detail: default, with-archive-banner, edit affordance
- create/edit: empty/populated, with-rich-text, with-color-background-picker, with-bucket-picker, with-member-target picker (or system-wide), submitting, conflict

## Mode notes

- Littles: simplified — no color backgrounds (white card only), no bucket scoping
- Static: color backgrounds flatten to single shade

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (color-bg note tile), FAB, RichTextField (ps-9yhh), ColorSwatchPicker, BucketPicker (ps-s9r6), MemberPicker (ps-djqo, optional target), ProxyChip (ps-jtvw, author), EmptyState (ps-ruwi), DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- `apps/api/src/trpc/routers/note.ts` list, get, create, update, archive, restore, delete

## Required output

- [ ] docs/design-system/preview/comm-notes.html with all surfaces + states
- [ ] Rationale on the color-card grid layout (masonry vs uniform)

## Out of scope

- RN code (M11), data wiring (M12)
