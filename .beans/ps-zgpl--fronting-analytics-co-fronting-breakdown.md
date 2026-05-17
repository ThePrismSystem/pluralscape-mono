---
# ps-zgpl
title: "Fronting: Analytics — co-fronting breakdown"
status: todo
type: feature
created_at: 2026-05-17T05:50:48Z
updated_at: 2026-05-17T05:50:48Z
parent: ps-5920
---

## Goal

Design the co-fronting pair analytics screen: pair matrix or chord visualization showing which members front together most often.

## Surfaces

- Co-fronting breakdown: `(app)/fronting/analytics/co-fronting.tsx`

## Required states per surface

- default (many co-fronting pairs)
- few pairs (2–5)
- single dominant pair
- empty (no co-fronting history)
- loading
- error

## Mode notes

- Matrix visualization needs accessible reading order: screen-reader should announce row-by-row pairs with totals.
- High-contrast mode: matrix cell intensity must use both opacity AND text labels — opacity-only violates color rules.

## Primitives required

- Heatmap / matrix primitive (Phase 0 candidate; block on it)
- AvatarStack (pair display in legend)
- SegmentedControl (period preset)
- EmptyState

## Data refs (informational)

- `apps/api/src/trpc/routers/analytics.ts` — co-fronting pair analytics

## Required output

- [ ] docs/design-system/preview/fronting-analytics-cofronting.html with all states
- [ ] Visualization decision (matrix vs chord vs bubble) with rationale

## Out of scope

- RN code (M11), data wiring (M12), mode coverage (Phase 3 sweep).
