---
# ps-pp0e
title: "Members: Custom fields manager"
status: todo
type: feature
created_at: 2026-05-17T06:37:52Z
updated_at: 2026-05-17T06:37:52Z
parent: ps-07l7
---

## Goal

Design the custom-field manager: list of field definitions, create / edit form, per-field bucket visibility, per-field scope to specific structure entity types.

## Surfaces

- Fields manager: `(app)/fields/index.tsx`
- New field: `(app)/fields/new.tsx`
- Edit field: `(app)/fields/[fieldId]/edit.tsx`

## Required states per surface

- list: empty (no fields defined), populated, with-scope-filter chip, archived view, error
- create/edit: empty/populated, with-validation-rules-section, with-bucket-visibility-section, with-entity-type-scoping-section, invalid, submitting, conflict

## Mode notes

- Littles: simplified — no validation rules section, no scoping
- High-contrast: per-bucket visibility toggles use both Switch + tier label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, ListItem (field row), TextField, Select (field type — text / number / date / select / multi-select), Switch (required, archived), BucketPicker (ps-s9r6, multi), EntityTypePicker (ps-gml0, multi-scope), EmptyState (ps-ruwi), Dialog (delete confirm)

## Data refs (informational)

- `apps/api/src/trpc/routers/field.ts` list, get, create, update, archive, delete; bucketVisibility sub-route; entityTypeScopes sub-route

## Required output

- [ ] docs/design-system/preview/members-custom-fields.html with all surfaces + states
- [ ] Rationale on field-type taxonomy and the per-bucket visibility UI per features.md §1

## Out of scope

- RN code (M11), data wiring (M12), how values get set on individual members (covered by Members detail tabs)
