---
# ps-o1zp
title: Design RecoveryKeyField primitive
status: todo
type: task
created_at: 2026-05-17T06:27:07Z
updated_at: 2026-05-17T06:27:07Z
parent: ps-udt1
---

## Goal

Design the RecoveryKeyField primitive: a paste-friendly multi-segment input for entering the XXXX-XXXX-XXXX-XXXX-XXXX-XXXX recovery key (ADR 011 §Path 1). Auto-formats on paste, supports per-segment editing, surfaces validation feedback.

## Required output

- [ ] `docs/design-system/preview/components-recovery-key-field.html` showing variants (empty, partial-fill, full, valid, invalid) and states (default, focused, error, success)
- [ ] Spec doc per SKILL.md §8 (with auto-format and paste-handling rules documented)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/typography.json` (monospace variant)
- Reference: ADR 011 recovery key format

## Out of scope

- RN code (M11), screen-level integration (Auth flow beans)
