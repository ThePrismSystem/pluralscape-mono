---
# ps-a5pt
title: Design SystemSwitcher primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:28:40Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the SystemSwitcher primitive: account → system pick surface reachable from the AppHeader. Shows the `SystemListItem[]` for the current account (features.md §6 multi-system support). On mobile invoked as a BottomSheet; on web ≥1024px as a Drawer panel or header dropdown.

## Required output

- [ ] `docs/design-system/preview/components-system-switcher.html` showing variants (single system — no switcher), 2-5 systems, many systems with search, and required states
- [ ] Spec doc per SKILL.md §8 (search threshold ~5 systems, sort order, "current" indicator)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §6, `SystemListItem` type in `packages/types/`

## Out of scope

- RN code (M11), screen-level integration (Home & Nav beans)

## Re-audit disposition (2026-05-17)

Dropdown shown in `components-nav-chrome.html` but with limited state
coverage.

Updated scope: read the existing nav-chrome treatment, design missing
states (loading systems list, error fetching, system-being-switched
intermediate), produce `components-system-switcher.html` with full state

- mode coverage. The littles-mode variant should be simpler (system
  switching is a power-user affordance).

Partial-extraction + light design task.
