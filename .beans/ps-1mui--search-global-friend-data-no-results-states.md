---
# ps-1mui
title: "Search: Global + friend-data + no-results states"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:45:34Z
updated_at: 2026-05-17T07:42:00Z
parent: ps-6a3x
blocked_by:
  - ps-5920
---

## Goal

Design the global search screen and the friend-data search screen, including shared no-results state.

## Surfaces

- Global search: `(app)/search/index.tsx`
- Friend-data search: `(app)/search/friend/[friendId].tsx`
- No-results: shared state

## Required states per surface

- global: idle (recent queries), typing, results (grouped per entity kind: members, fronting sessions, notes, board messages, journal, wiki), no-results, with-filter chips, error, loading
- friend-data: idle (bucket-scoped query), typing, results (grouped per shared entity kind), no-results-because-no-share-permission, no-results-because-no-match, error
- no-results: shared empty-state copy variants per context

## Mode notes

- Littles: search limited to member names only (no rich-data search)
- High-contrast: result-row icons indicate entity-kind disambiguation

## Primitives required

- ScreenScaffold, SearchHeader (ps-oylh), InfiniteList (ps-hijf), Card (per-entity result row), Chip (filter, entity-kind), EmptyState (ps-ruwi, no-results variant), Banner (no-share-permission), KeyValueRow (ps-5lr6)

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` search
- friend-data uses bucket-filtered client-side search (per features.md §4)

## Required output

- [ ] docs/design-system/preview/search-all.html with all surfaces + states
- [ ] Rationale on entity-kind grouping order and filter affordance placement

## Out of scope

- RN code (M11), data wiring (M12), the SearchHeader primitive (Phase 0)
