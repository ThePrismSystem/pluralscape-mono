---
# ps-bflw
title: "Journaling: Journal entry editor (with fronting snapshot insert)"
status: todo
type: feature
created_at: 2026-05-17T06:44:28Z
updated_at: 2026-05-17T06:44:28Z
parent: ps-djgs
---

## Goal

Design the journal entry editor (block-based per features.md §7) plus the fronting snapshot insert affordance (inserts a frozen snapshot block referencing the active fronting state at insert time).

## Surfaces

- New: `(app)/journal/entries/new.tsx`
- Edit: `(app)/journal/entries/[id]/edit.tsx`
- Fronting snapshot insert: inline within editor

## Required states per surface

- editor: empty (new), populated (edit), with-block-menu-open, with-slash-command-palette, with-image-upload-pending, with-fronting-snapshot-block, with-member-link-block, save-status indicator (saving / saved / offline-queued)
- snapshot insert: idle (with current fronting preview), inserted (as immutable block), error (key-unavailable for older snapshot)

## Mode notes

- Littles: simplified — paragraph + image blocks only; no slash-commands, no fronting snapshot
- High-contrast: block boundaries use border-strong on hover

## Primitives required

- ScreenScaffold, BlockEditor (ps-zpyu), ProxyChip (ps-jtvw, author at top), BucketPicker (ps-s9r6), FrontingChip (ps-458i, current state preview), ImagePickerLauncher, ImageCropper (ps-107o), MemberPicker (ps-djqo, member-link target), Button, Banner (offline notice), SyncIndicator (ps-gnkq)

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` create, update
- `apps/api/src/trpc/routers/fronting-session.ts` snapshot (frozen reference at insert time)
- `apps/api/src/trpc/routers/blob.ts` upload

## Required output

- [ ] docs/design-system/preview/journal-entry-editor.html with all states
- [ ] Rationale on snapshot-block visual (read-only mini-card vs inline text)

## Out of scope

- RN code (M11), data wiring (M12), the BlockEditor primitive (Phase 0)
