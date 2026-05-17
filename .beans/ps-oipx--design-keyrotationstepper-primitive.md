---
# ps-oipx
title: Design KeyRotationStepper primitive
status: todo
type: task
created_at: 2026-05-17T06:29:52Z
updated_at: 2026-05-17T06:29:52Z
parent: ps-udt1
---

## Goal

Design the KeyRotationStepper primitive: visual progress indicator for the chunked bucket-key rotation protocol (ADR 014). Shows initiate → progress (N of M chunks) → complete states, plus retry-from-failed-chunk path. Used inline on the bucket rotation tab.

## Required output

- [ ] `docs/design-system/preview/components-key-rotation-stepper.html` showing the steps (initiate, in-progress, retry-required, complete, error-terminal) and required states
- [ ] Spec doc per SKILL.md §8 (estimated time display rules; resume-from-checkpoint affordance copy)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/motion.json`
- Reference: ADR 014, features.md §4 bucket key rotation

## Out of scope

- RN code (M11), screen-level integration (Privacy & Social beans)
