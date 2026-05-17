---
# ps-qv5s
title: "Fronting: Timeline visualization + filter sheet"
status: todo
type: feature
created_at: 2026-05-17T05:50:33Z
updated_at: 2026-05-17T05:50:33Z
parent: ps-5920
---

## Goal

Design the multi-lane swimlane timeline visualization (color-coded per member with co-fronting overlap visible) and its filter sheet.

## Surfaces

- Timeline: `(app)/fronting/timeline.tsx` — vertical or horizontal swimlanes per member, time axis, co-fronting overlap rendered.
- Filter sheet: `(sheets)/timeline-filter.tsx` — date range, member subset, bucket filter, period preset (day / week / month / custom).

## Required states per surface

- timeline: dense day (many switches), sparse week, empty (no sessions in range), loading-tail (paginated load), error
- filter: idle, applying, applied (chip visible on timeline header), reset

## Mode notes

- High-contrast mode: member colors must pair with shape glyph or pattern fill — color-only swimlanes violate identity rules.
- Reduced-motion: disable any scrub / scroll animation.
- Static mode: flat lane fills (no gradient member color strips).
- Littles mode: simplified day-view only; week/month hidden.

## Primitives required

- FrontingTimelineLane (Phase 0 must produce — block on it)
- SegmentedControl (period preset)
- DateRangePicker
- MultiMemberPicker (filter)
- BucketPicker (filter)
- BottomSheet (filter host)
- EmptyState
- Chip (active-filter indicator on timeline header)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` — list with cursor pagination
- `apps/api/src/trpc/routers/analytics.ts` — period summaries

## Required output

- [ ] docs/design-system/preview/fronting-timeline.html with all states
- [ ] Layout / interaction rationale (including swimlane direction decision: horizontal-time vs vertical-time)

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond structural notes (Phase 3 sweep).
