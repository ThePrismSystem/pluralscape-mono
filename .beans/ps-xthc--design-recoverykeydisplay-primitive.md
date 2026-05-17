---
# ps-xthc
title: Design RecoveryKeyDisplay primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:27:22Z
updated_at: 2026-05-17T19:06:45Z
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

## Mode coverage update (2026-05-17)

Skip the Littles-mode variant for this primitive. Recovery-key flows
happen during account setup and account recovery — both of those run
before Littles Mode is configurable, so a Littles variant is never
rendered in production. Cover default, low-sensory, and high-contrast
only.
