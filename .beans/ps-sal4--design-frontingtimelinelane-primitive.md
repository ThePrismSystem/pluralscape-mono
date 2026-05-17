---
# ps-sal4
title: Design FrontingTimelineLane primitive
status: todo
type: task
created_at: 2026-05-17T06:29:08Z
updated_at: 2026-05-17T06:29:08Z
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
