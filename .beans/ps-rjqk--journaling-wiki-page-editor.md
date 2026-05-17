---
# ps-rjqk
title: "Journaling: Wiki page editor"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:44:48Z
updated_at: 2026-05-17T07:42:08Z
parent: ps-djgs
blocked_by:
  - ps-5920
---

## Goal

Design the wiki page editor — block-based, multi-author collaborative with per-author edit attribution.

## Surfaces

- New: `(app)/journal/wiki/new.tsx`
- Edit: `(app)/journal/wiki/[id]/edit.tsx`

## Required states per surface

- editor: empty (new), populated (edit), with-block-menu, with-other-author-typing indicator, with-conflict-banner (concurrent edit), save-status indicator (saving / saved / offline-queued), with-category-picker, with-bucket-picker

## Mode notes

- Littles: simplified — paragraph + image blocks only
- High-contrast: other-author indicators use border-strong + initial

## Primitives required

- ScreenScaffold, BlockEditor (ps-zpyu), Avatar (other-author typing), BucketPicker (ps-s9r6), Select (category), MemberPicker (ps-djqo, member-link), Button, Banner (conflict), SyncIndicator (ps-gnkq)

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` wiki create, update, sync-events

## Required output

- [ ] docs/design-system/preview/journal-wiki-editor.html with all states
- [ ] Rationale on collaborative-edit attribution UX (inline marker vs gutter avatar)

## Out of scope

- RN code (M11), data wiring (M12), the BlockEditor primitive (Phase 0)
