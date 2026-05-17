---
# ps-dlf0
title: "Structure: Entity create / edit form"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:42:54Z
updated_at: 2026-05-17T07:42:04Z
parent: ps-7wf6
blocked_by:
  - ps-5920
---

## Goal

Design the entity create / edit form — pick type, name, color, image, emoji, parent entity, member-link affordance.

## Surfaces

- New: `(app)/structure/entities/new.tsx`
- Edit: `(app)/structure/entities/[id]/edit.tsx`

## Required states per surface

- form: empty (new), populated (edit), with-parent-picker open (cycle-warning if invalid), invalid, submitting, conflict
- with-member-links pre-populated (for edit)

## Mode notes

- Littles: hidden
- High-contrast: per-field labels are top-aligned + bold

## Primitives required

- ScreenScaffold, EntityTypePicker (ps-gml0), TextField, ColorSwatchPicker, EmojiPicker, ImagePickerLauncher, MultiMemberPicker (ps-djqo, member-links), Banner (cycle warning), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/structure.ts` entity create, update, parent change

## Required output

- [ ] docs/design-system/preview/structure-entity-create-edit.html with all states

## Out of scope

- RN code (M11), data wiring (M12), entity detail (separate bean)
