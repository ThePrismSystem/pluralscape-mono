---
# ps-gfhz
title: Design EncryptionTierBadge primitive
status: todo
type: task
created_at: 2026-05-17T06:27:26Z
updated_at: 2026-05-17T06:27:26Z
parent: ps-udt1
---

## Goal

Design the EncryptionTierBadge primitive: small lock indicator with T1 / T2 / T3 variants. Tap or long-press reveals an explainer popover describing what the tier means for visibility (T1 zero-knowledge, T2 per-bucket, T3 server-visible metadata).

## Required output

- [ ] `docs/design-system/preview/components-encryption-tier.html` showing T1 / T2 / T3 variants with the explainer popover open
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md encryption tier definitions; `docs/design-system/uploads/SCREENS.md` §12.7

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
