---
# ps-rhno
title: Design WizardStepper pattern
status: todo
type: task
created_at: 2026-05-17T06:31:13Z
updated_at: 2026-05-17T06:31:13Z
parent: ps-udt1
---

## Goal

Design the WizardStepper pattern: multi-step linear-flow composition. Used by the setup wizard (6 steps), sign-up (account-type → password → recovery), bucket-key rotation (initiate → progress → complete), system duplicate wizard, import wizards (SP and PK).

## Required output

- [ ] `docs/design-system/preview/patterns-wizard-stepper.html` showing the stepper chrome variants (top-progress, side-rail, minimal-counter) and the step transitions, plus the back / next / skip affordance rules
- [ ] Spec doc per SKILL.md §8 (back-navigation rules per flow type: destructive flows disable back after a point; non-destructive flows allow free back-nav)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/motion.json`
- Reference: existing setup wizard sketch in `ui_kits/mobile/Screen_*.jsx`, features.md §6 setup wizard

## Out of scope

- RN code (M11), screen-level integration of any specific wizard (those are separate Phase 2 beans)
