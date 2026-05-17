---
# ps-ecpl
title: Design Accordion primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:57Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the Accordion primitive: expandable section with header + chevron + collapsible body. Used for FAQ, setup-wizard recap, audit-log grouped entries, advanced settings.

## Required output

- [ ] `docs/design-system/preview/components-accordion.html` showing variants (single, multi-open, with leading icon, with trailing badge) and required states per SKILL.md §7
- [ ] Spec doc per SKILL.md §8 (keyboard a11y: arrow keys move between headers, Enter / Space toggles, focus stays on header)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/motion.json` (expand animation), `tokens/spacing.json`
- Reference: existing `components-rows-tree.html` as visual baseline

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Already designed in `components-display.html` (Accordion section). Open
and closed states rendered.

Updated scope: extract into `components-accordion.html`. Add the 8
acceptance states, 4 mode variants, 7-section doc. Specifically cover:
keyboard navigation (Space/Enter to toggle, Arrow keys to move between
panels), `aria-expanded` and `aria-controls` wiring, animated open/close
that collapses cleanly under reduced motion.

Extraction task.
