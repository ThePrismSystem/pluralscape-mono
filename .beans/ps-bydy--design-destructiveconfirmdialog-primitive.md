---
# ps-bydy
title: Design DestructiveConfirmDialog primitive
status: todo
type: task
created_at: 2026-05-17T06:27:31Z
updated_at: 2026-05-17T06:27:31Z
parent: ps-udt1
---

## Goal

Design the DestructiveConfirmDialog primitive: typed-phrase confirmation extending the base Dialog. Required for the Critical tier of destructive actions per GOVERNANCE.md §6 — account purge, recovery-key regenerate, system delete, friend block, snapshot delete.

## Required output

- [ ] `docs/design-system/preview/components-destructive-confirm.html` showing variants (typed-phrase, hold-to-confirm fallback, multi-step) and required states per SKILL.md §7
- [ ] Spec doc per SKILL.md §8 including the GOVERNANCE.md §6 tier mapping

## Tokens / references

- Tokens: `tokens/colors.json` (danger palette)
- Reference: GOVERNANCE.md §6 destructive-action tiers, `patterns.html` "Destructive-action confirmation" pattern

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)
