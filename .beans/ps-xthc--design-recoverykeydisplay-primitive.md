---
# ps-xthc
title: Design RecoveryKeyDisplay primitive
status: todo
type: task
created_at: 2026-05-17T06:27:22Z
updated_at: 2026-05-17T06:27:22Z
parent: ps-udt1
---

## Goal

Design the RecoveryKeyDisplay primitive: the big readable key-reveal surface used during sign-up. Includes copy / save-as-PDF / save-to-file / print buttons and a hard-to-miss warning that the key will not be shown again.

## Required output

- [ ] `docs/design-system/preview/components-recovery-key-display.html` showing variants (reveal, post-copy ack, redacted-after-acknowledge) and required states per SKILL.md §7
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json` (warning palette), `tokens/typography.json` (monospace)
- Reference: ADR 011, GOVERNANCE.md §6 destructive-action tiers

## Out of scope

- RN code (M11), screen-level integration (Auth flow beans)
