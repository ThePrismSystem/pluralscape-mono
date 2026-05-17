---
# ps-s1ec
title: "Fronting: Analytics — fronting summary"
status: todo
type: feature
created_at: 2026-05-17T05:50:43Z
updated_at: 2026-05-17T05:50:43Z
parent: ps-5920
---

## Goal

Design the per-subject fronting summary analytics screen: cumulative duration, average session length, percentage breakdown.

## Surfaces

- Analytics summary: `(app)/fronting/analytics/index.tsx`

## Required states per surface

- default (3+ members)
- small system (1–2 members) — different chart treatment
- single fronter dominates (>80%)
- empty (no fronting data in range)
- loading
- error

## Mode notes

- High-contrast mode: bar / donut charts need text labels alongside color segments.
- Reduced-motion: chart entrance animations disabled.
- Static mode: flat fills, no gradient chart segments.

## Primitives required

- SegmentedControl (period preset)
- Chart primitive — donut + horizontal bar (Phase 0 candidate; block on it)
- MemberCard (legend / detail rows)
- KeyValueRow (summary stats: total duration, session count, avg length)
- EmptyState

## Data refs (informational)

- `apps/api/src/trpc/routers/analytics.ts` — per-subject breakdown (members + custom fronts + structure entities)

## Required output

- [ ] docs/design-system/preview/fronting-analytics-summary.html with all states
- [ ] Chart treatment decisions (donut vs bar, axis labels, member color → glyph fallback for accessibility)

## Out of scope

- RN code (M11), data wiring (M12), mode coverage (Phase 3 sweep), per-co-fronting-pair analytics (separate bean).
