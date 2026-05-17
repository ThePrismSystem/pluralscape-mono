---
# ps-5gzc
title: "Journaling: Wiki pages (list + detail)"
status: todo
type: feature
created_at: 2026-05-17T06:44:35Z
updated_at: 2026-05-17T06:44:35Z
parent: ps-djgs
---

## Goal

Design the wiki pages list and page detail view. Wiki is collaborative (multi-member authorship) while journal entries are typically single-author.

## Surfaces

- Wiki list: `(app)/journal/wiki/index.tsx`
- Wiki detail: `(app)/journal/wiki/[id]/index.tsx`

## Required states per surface

- list: empty, populated, with-categories grouping, with-search, archived view, error
- detail: default (with-multi-author chip stack, last-edited indicator), with-edit affordance, with-page-history popover (changelog), archived

## Mode notes

- Littles: simplified — single-page format, no categories
- High-contrast: per-page-card uses border + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (page tile), FAB, Accordion (ps-ecpl, for categories), AvatarStack (multi-author chip), KeyValueRow (ps-5lr6), Popover (ps-rgrw, page history), EmptyState (ps-ruwi), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` wiki list, get, history

## Required output

- [ ] docs/design-system/preview/journal-wiki-list-detail.html with all states
- [ ] Rationale on category visualization (left rail vs accordion vs top tabs)

## Out of scope

- RN code (M11), data wiring (M12), editor (separate bean), destructive flows (separate bean)
