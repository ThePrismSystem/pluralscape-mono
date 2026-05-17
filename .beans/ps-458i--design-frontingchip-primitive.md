---
# ps-458i
title: Design FrontingChip primitive
status: todo
type: task
created_at: 2026-05-17T06:28:55Z
updated_at: 2026-05-17T06:28:55Z
parent: ps-udt1
---

## Goal

Design the FrontingChip primitive: per-member or per-custom-front active-fronter mini-card showing avatar + name + duration + optional status text. Used in the AppHeader (current fronter badge), Front overview, and AvatarStack expanded view.

## Required output

- [ ] `docs/design-system/preview/components-fronting-chip.html` showing variants (compact, expanded with status, co-fronting badge, custom-front variant, structure-entity variant) and required states
- [ ] Spec doc per SKILL.md §8 covering: identity pairing rule (color + shape + initial per GOVERNANCE.md §4), duration format (live-updating clock), status-text truncation (50 char per features.md §2)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/typography.json`
- Reference: features.md §2, GOVERNANCE.md §4

## Out of scope

- RN code (M11), screen-level integration (Fronting beans)
