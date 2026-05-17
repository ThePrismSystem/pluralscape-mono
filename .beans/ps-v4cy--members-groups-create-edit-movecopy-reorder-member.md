---
# ps-v4cy
title: "Members: Groups — create / edit + move/copy + reorder + member assignment"
status: todo
type: feature
created_at: 2026-05-17T06:37:33Z
updated_at: 2026-05-17T06:37:33Z
parent: ps-07l7
---

## Goal

Design the group management operations — create/edit form, move-or-copy modal (cross-folder), reorder mode, member assignment modal.

## Surfaces

- New: `(app)/groups/new.tsx`
- Edit: `(app)/groups/[groupId]/edit.tsx`
- Move/copy: `(modals)/group-move.tsx`
- Reorder mode: `(app)/groups/reorder.tsx`
- Add member: `(modals)/group-add-member.tsx`

## Required states per surface

- create/edit form: empty/populated, invalid, submitting, conflict
- move/copy: pick-target-folder, move-vs-copy toggle, with-cycle-warning (cannot move group into its own descendant), submitting
- reorder: drag-and-drop active, save / cancel affordances, conflict
- add member: search + multi-pick, with-already-member chips, submitting

## Mode notes

- Littles: move/copy hidden; reorder uses up/down arrow buttons instead of drag
- High-contrast: drag indicator uses border-strong handle

## Primitives required

- ScreenScaffold, TextField, ColorSwatchPicker, EmojiPicker, BucketPicker (ps-s9r6), MultiMemberPicker (ps-djqo), BottomSheet, Button, Banner (cycle warning), Switch (move vs copy)

## Data refs (informational)

- `apps/api/src/trpc/routers/group.ts` create, update, move, copy, reorder, addMember, removeMember

## Required output

- [ ] docs/design-system/preview/members-groups-management.html with all surfaces + states
- [ ] Rationale on the move-vs-copy affordance pattern (single sheet vs two screens)

## Out of scope

- RN code (M11), data wiring (M12), the list / detail screens (separate bean)
