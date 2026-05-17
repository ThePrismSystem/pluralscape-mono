---
# ps-ruwi
title: Design EmptyState primitive
status: todo
type: task
created_at: 2026-05-17T06:26:53Z
updated_at: 2026-05-17T06:26:53Z
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
