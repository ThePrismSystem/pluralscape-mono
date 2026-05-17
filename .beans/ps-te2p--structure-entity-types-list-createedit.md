---
# ps-te2p
title: "Structure: Entity types (list + create/edit)"
status: todo
type: feature
created_at: 2026-05-17T06:42:27Z
updated_at: 2026-05-17T06:42:27Z
parent: ps-7wf6
---

## Goal

Design the entity-type surfaces — list of user-defined types per system (e.g. "Subsystem", "Side System", "Layer"), and the create / edit form (name, color, image source, emoji, architecture type, gatekeeper).

## Surfaces

- Entity-type list: `(app)/structure/types/index.tsx`
- New: `(app)/structure/types/new.tsx`
- Edit: `(app)/structure/types/[id]/edit.tsx`

## Required states per surface

- list: empty, populated, archived view, error
- create/edit: empty/populated, with all metadata fields (name, color, image source, emoji, architecture-type pick, gatekeeper member picker), invalid, submitting, conflict

## Mode notes

- Littles: hidden entirely
- High-contrast: per-type tile uses border + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, Card (type tile), TextField, TextArea, ColorSwatchPicker, EmojiPicker, ImagePickerLauncher, MemberPicker (ps-djqo, gatekeeper), Select (architecture type), EmptyState (ps-ruwi), DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- `apps/api/src/trpc/routers/structure.ts` types subrouter

## Required output

- [ ] docs/design-system/preview/structure-entity-types.html with all surfaces + states
- [ ] Rationale on architecture-type taxonomy and how it surfaces in entity detail

## Out of scope

- RN code (M11), data wiring (M12), entity hierarchy / detail (separate beans)
