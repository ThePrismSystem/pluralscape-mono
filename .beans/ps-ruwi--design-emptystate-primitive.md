---
# ps-ruwi
title: Design EmptyState primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:26:53Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the EmptyState primitive: preview HTML + spec doc per `docs/design-system/SKILL.md` §8. Composes constellation illustration variant, copy line, and optional primary CTA. Used on every list screen with no data.

## Required output

- [ ] `docs/design-system/preview/components-empty-state.html` showing variants (constellation, sparse, illustrated) and states (default, with-CTA, no-CTA, with-secondary-action)
- [ ] Spec doc covering §8.1 anatomy, §8.2 required states, §8.3 a11y intent, §8.4 mode behavior, §8.5 content rules, §8.6 usage rules, §8.7 bad example

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/typography.json`
- Reference: existing `components-display.html` `state` class as starting point

## Out of scope

- React Native code (M11), screen-level integration (Phase 1 / 2)

## Re-audit disposition (2026-05-17)

Original audit (ps-sg8k) classified EmptyState as missing. Re-audit found
the canon is already established:

- `docs/design-system/preview/illustrations.html` is the canonical empty-state
  system: Domestic Interiors line vignettes, 12-motif vocabulary, 3-ink
  palette, six applied canonical empty states (Empty journal, Empty fronting
  log, No friends, First run, Empty notes, Offline) with Caveat-italic
  annotations.
- `docs/design-system/preview/components-display.html:378-410` shows the
  structural pattern (vignette + title + body + CTA) paired with ErrorState.

Updated scope: extract the structural EmptyState component into a dedicated
preview at `components-empty-state.html` that composes a Domestic Interiors
vignette with the structural pattern, adds the 8 acceptance states from
SKILL.md §7 (default, hover, pressed, disabled, focus-visible, loading,
error, screen-reader — most are N/A for a static state surface; mark them
explicitly), 4 mode variants (default, low-sensory flattens the vignette,
high-contrast promotes the body text contrast, littles uses simpler copy
and a larger CTA), and the 7-section doc contract.

This is an extraction + doc task, not a from-scratch design.
