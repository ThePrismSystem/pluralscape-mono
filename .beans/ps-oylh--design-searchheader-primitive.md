---
# ps-oylh
title: Design SearchHeader primitive
status: todo
type: task
created_at: 2026-05-17T06:28:44Z
updated_at: 2026-05-17T06:28:44Z
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
