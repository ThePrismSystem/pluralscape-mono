---
# ps-rgrw
title: Design Popover primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:47Z
updated_at: 2026-05-17T08:50:23Z
parent: ps-udt1
---

## Goal

Design the Popover primitive: anchored tap/hover explanation surface, distinct from Tooltip (short text-only on hover/long-press) and BottomSheet (drag-up surface). Popover is anchored to a trigger and can hold rich content (icons, links, multi-line copy). On mobile, popovers anchored near screen edges flip orientation; on web, the Popover API + anchor positioning handles placement.

## Required output

- [ ] `docs/design-system/preview/components-popover.html` showing variants (top, bottom, left, right anchor) and required states per SKILL.md §7
- [ ] Spec doc per SKILL.md §8 documenting the mobile-popover-becomes-bottom-sheet rule at narrow viewports

## Tokens / references

- Tokens: `tokens/colors.json` (surface), `tokens/elevation.json`, `tokens/radii.json`
- Reference: `packages/design-system/docs/cross-platform-parity.md` (popover-on-desktop = bottom-sheet-on-mobile)

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Already designed in `components-feedback.html:298-318` paired with Tooltip.
Anchored popover with rich content (the existing demo is the "Server-visible
metadata" plaintext explainer), plus tooltip variant for ephemeral
single-line content.

Updated scope: extract into `components-popover.html`. Add: anchor-side
variants (top/bottom/left/right), dismiss-on-outside-tap behavior, the
8 acceptance states (focus-visible matters — Esc dismisses, Tab moves to
contents), 4 mode variants, 7-section doc.

Extraction task.
