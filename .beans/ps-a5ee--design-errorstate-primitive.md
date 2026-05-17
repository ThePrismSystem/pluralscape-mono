---
# ps-a5ee
title: Design ErrorState primitive
status: todo
type: task
created_at: 2026-05-17T06:26:58Z
updated_at: 2026-05-17T06:26:58Z
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
