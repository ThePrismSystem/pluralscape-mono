---
# ps-99lr
title: "Journaling: Journal entries (list + detail)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:44:17Z
updated_at: 2026-05-17T07:42:03Z
parent: ps-djgs
blocked_by:
  - ps-5920
---

## Goal

Design the journal entries list and entry detail view.

## Surfaces

- Entries list: `(app)/journal/entries/index.tsx`
- Entry detail: `(app)/journal/entries/[id]/index.tsx`

## Required states per surface

- list: empty, populated, filtered (by-member-author, by-date-range, by-bucket), archived view, with-search-active, error
- detail: default (with author + date + bucket pill + fronting-context-at-time-of-entry), with-edit affordance, archived

## Mode notes

- Littles: entries by trauma-marker authors hidden by default; simplified detail layout
- High-contrast: per-entry-card uses border-strong

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (entry tile), FAB, ProxyChip (ps-jtvw, author), BucketPill (ps-i6n1), KeyValueRow (ps-5lr6), FrontingChip (ps-458i, snapshot at time), EmptyState (ps-ruwi), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` list, get, archive, restore

## Required output

- [ ] docs/design-system/preview/journal-entries-list-detail.html with all states
- [ ] Rationale on entry-card density (compact vs expanded preview)

## Out of scope

- RN code (M11), data wiring (M12), editor (separate bean)
