---
# ps-a5ee
title: Design ErrorState primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:26:58Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the ErrorState primitive: a first-class screen-level error display with retry CTA and optional error-code reveal. Distinct from inline Banner — ErrorState replaces a list's content, Banner adorns the top.

## Required output

- [ ] `docs/design-system/preview/components-error-state.html` showing variants (recoverable with retry, terminal without retry, with-code-reveal) and states (default, retrying, retry-failed)
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json` (semantic danger), `tokens/typography.json`
- Reference: existing `state state--error` in `components-display.html`; reuse pattern

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Original audit (ps-sg8k) classified ErrorState as missing. Re-audit found
it paired with EmptyState in `components-display.html:378-410` with one
example: "Couldn't send invite — check your connection, retry automatically,
your draft is saved." Tone rules from GOVERNANCE §7.

Updated scope: extract into `components-error-state.html`. Show the
distinction from EmptyState (errors only fire on actions that can actually
fail — sends, sync, exports — because the product is offline-first and a
generic "load failed" surface is wrong). Add: retry affordance variant,
permanent-failure variant (no retry possible), the 8 acceptance states,
4 mode variants, 7-section doc.

Extraction task, not from-scratch.
