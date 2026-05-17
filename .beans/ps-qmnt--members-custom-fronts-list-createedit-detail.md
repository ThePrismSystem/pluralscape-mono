---
# ps-qmnt
title: "Members: Custom fronts (list + create/edit + detail)"
status: todo
type: feature
created_at: 2026-05-17T06:37:15Z
updated_at: 2026-05-17T06:37:15Z
parent: ps-07l7
---

## Goal

Design the custom-front surfaces — abstract cognitive states logged like members (e.g. "Dissociated", "Blurry"). List, create/edit form, detail.

## Surfaces

- Custom-front list: `(app)/custom-fronts/index.tsx`
- New: `(app)/custom-fronts/new.tsx`
- Edit: `(app)/custom-fronts/[id]/edit.tsx`
- Detail: `(app)/custom-fronts/[id]/index.tsx`

## Required states per surface

- list: empty, populated, archived view
- create/edit form: empty/populated, invalid, submitting, conflict
- detail: default, with-fronting-history sample, archived

## Mode notes

- Littles: custom-front feature disabled by default (parent / caregiver toggle)
- High-contrast: custom-front visual differentiation from members uses icon + label (in addition to color)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB, MemberCard variant (custom-front), TextField, TextArea, ColorSwatchPicker, EmojiPicker, EmptyState (ps-ruwi), Dialog (delete confirm)

## Data refs (informational)

- `apps/api/src/trpc/routers/custom-front.ts` CRUD + archive/restore

## Required output

- [ ] docs/design-system/preview/members-custom-fronts.html with all surfaces + states
- [ ] Rationale on visual distinction from Members in list contexts

## Out of scope

- RN code (M11), data wiring (M12), fronting integration for custom fronts (Fronting beans cover that)
