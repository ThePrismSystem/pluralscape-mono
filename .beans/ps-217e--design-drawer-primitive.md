---
# ps-217e
title: Design Drawer primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:28:30Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the Drawer primitive: side-drawer chrome for web and tablet ≥1024px viewports. Mobile uses a bottom-tab "More" surface instead — the Drawer is not shown on phone. Hosts secondary navigation, system switcher, and settings entry on larger viewports.

## Required output

- [ ] `docs/design-system/preview/components-drawer.html` showing variants (collapsed-rail, expanded, expanded-with-system-switcher-open) and required states
- [ ] Spec doc per SKILL.md §8 documenting the ≥1024px breakpoint rule and the keyboard-trap behavior when in mobile sheet mode

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/breakpoints.json`, `tokens/elevation.json`
- Reference: `packages/design-system/docs/cross-platform-parity.md` (tab bar bottom <1024, drawer left ≥1024)

## Out of scope

- RN code (M11), screen-level integration (Home & Nav beans)

## Re-audit disposition (2026-05-17)

Mentioned in `components-nav-chrome.html` but without detailed state or
mode coverage. Less coverage than the other EXTRACT beans — closer to
"flesh out + extract" than pure extraction.

Updated scope: read the existing nav-chrome treatment, design the missing
state coverage (collapsed/expanded, dragging, dismissing), produce
`components-drawer.html` with the 8 acceptance states and 4 mode variants
(littles is the key one — drawer may need wider hit targets and simpler
contents). 7-section doc.

Partial-extraction + light design task.
