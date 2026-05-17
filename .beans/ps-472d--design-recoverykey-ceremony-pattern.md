---
# ps-472d
title: Design RecoveryKey ceremony pattern
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:30:59Z
updated_at: 2026-05-17T19:06:46Z
parent: ps-udt1
---

## Goal

Design the RecoveryKey ceremony pattern: the three-screen composition (reveal + ack-checkboxes → confirmation challenge → reminder modal) that surrounds the RecoveryKeyDisplay and RecoveryKeyField primitives during sign-up and post-reset. Pattern-level beats: introduce, reveal, demand-engagement, periodic-verify.

## Required output

- [ ] `docs/design-system/preview/patterns-recovery-key-ceremony.html` showing the three screens as a composition with state transitions documented
- [ ] Spec doc per SKILL.md §8 (composition-level — when to break out vs reuse the pattern; copy contract per GOVERNANCE.md §7)

## Tokens / references

- Tokens: `tokens/colors.json` (warning palette), `tokens/typography.json`
- Reference: ADR 011, features.md §14 security, the primitive beans for RecoveryKeyDisplay and RecoveryKeyField

## Out of scope

- RN code (M11), screen-level integration (Auth flow beans)

## Mode coverage update (2026-05-17)

Skip the Littles-mode variant for this pattern. Recovery-key ceremony
happens during account setup and recovery — both predate Littles Mode
configuration. Drop the earlier "littles skip-verification OR adult
confirmation" decision; not needed.
