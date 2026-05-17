---
# ps-oylh
title: Design SearchHeader primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:28:44Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the SearchHeader primitive: inline search bar header used in pickers (MemberPicker, BucketPicker) and the global Search screen. Distinct from AppHeader — SearchHeader replaces or augments the header in search-active contexts with the input expanded, cancel affordance visible.

## Required output

- [ ] `docs/design-system/preview/components-search-header.html` showing variants (idle, typing, with-results-count, no-results, with-active-filters chips) and required states
- [ ] Spec doc per SKILL.md §8 covering: focus management on mount, clear-query button, cancel returns to underlying header

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §15 search

## Out of scope

- RN code (M11), screen-level integration (Search beans)

## Re-audit disposition (2026-05-17)

JSX implementation exists in `docs/design-system/ui_kits/mobile/LibraryComponents.jsx`
and is used in `Screen_Library.jsx`, but no dedicated preview file.

Updated scope: extract the JSX implementation into a dedicated
`components-search-header.html` preview. Add: focused/blurred states,
clear-button affordance, voice-search affordance (if applicable),
recent-searches popover, the 8 acceptance states, 4 mode variants,
7-section doc.

Extraction task.
