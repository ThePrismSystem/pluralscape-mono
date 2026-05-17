---
# ps-sal4
title: Design FrontingTimelineLane primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:29:08Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the FrontingTimelineLane primitive: one member's track within the multi-lane Timeline visualization. Single-color or gradient strip with session segments, status-text tooltip on hover/long-press, co-fronting overlap rendered as a stacked second lane.

## Required output

- [ ] `docs/design-system/preview/components-fronting-timeline-lane.html` showing variants (single member, with-status-tooltip-open, co-fronting overlap with neighbor) and required states (default, focused, dragging-edit, error)
- [ ] Spec doc per SKILL.md §8 (color-only-not-allowed rule in high-contrast mode → pattern fill or text label; reduced-motion disables drag-edit animation)

## Tokens / references

- Tokens: `tokens/colors.json` (member palette), `tokens/motion.json`
- Reference: GOVERNANCE.md §4 identity rules, existing `components-fronting-history.html` and `patterns.html` Fronting timeline pattern

## Out of scope

- RN code (M11), screen-level integration (Fronting beans)

## Re-audit disposition (2026-05-17)

The lane primitive is implicit inside the `FrontingTimeline` parent
component, not yet separated as its own primitive. Existing assets:

- `docs/design-system/ui_kits/mobile/FrontingTimeline.jsx` — full editable
  timeline with drag boundary handles, focus + ←/→ for 5-min steps,
  co-fronting overlays, screen-reader segment announcements
- `docs/design-system/preview/patterns.html:238-242` — demo
- `docs/design-system/preview/components-fronting-history.html` — fronting
  history screen layout using lanes (vertical + horizontal views)

Updated scope: extract the **lane sub-component** as a standalone primitive
in `components-fronting-timeline-lane.html`. Variants to render: ongoing
(no end time, fade), ended, micro-session (under 5min collapsed), co-fronting
(overlapping translucent ranges). Document the composition contract so the
parent FrontingTimeline can consume it without restructuring. Add the 8
acceptance states, 4 mode variants, 7-section doc.

Extraction-with-decomposition task.
