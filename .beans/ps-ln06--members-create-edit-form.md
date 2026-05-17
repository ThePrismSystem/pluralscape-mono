---
# ps-ln06
title: "Members: Create / edit form"
status: todo
type: feature
created_at: 2026-05-17T06:36:42Z
updated_at: 2026-05-17T06:36:42Z
parent: ps-07l7
---

## Goal

Design the member create / edit form screens. New uses a single full-form flow; edit is the same form pre-populated.

## Surfaces

- New: `(app)/members/new.tsx`
- Edit: `(app)/members/[memberId]/edit.tsx`

## Required states per surface

- form: empty (new), populated (edit), invalid (e.g. name required), submitting, conflict (concurrent edit on edit-form), success, with-image-crop-modal-open

## Mode notes

- Littles: simplified form — name + color + avatar only; tags / saturation / structure-entity-links collapsed into "More" disclosure
- High-contrast: color-swatch picker pairs swatch + label

## Primitives required

- ScreenScaffold, TextField, TextArea, ColorSwatchPicker (existing), EmojiPicker (existing), TagPicker (ps-jleu), SaturationPicker (ps-xts0), ImagePickerLauncher (existing), ImageCropper (ps-107o), BucketPicker (ps-s9r6), Button, Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/member.ts` create, update
- `apps/api/src/trpc/routers/blob.ts` presigned upload

## Required output

- [ ] docs/design-system/preview/members-create-edit.html with all states
- [ ] Rationale on field ordering and which fields are top-level vs disclosure

## Out of scope

- RN code (M11), data wiring (M12), the duplicate flow (separate bean), the photo gallery management (separate bean)
