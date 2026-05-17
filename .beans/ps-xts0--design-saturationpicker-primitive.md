---
# ps-xts0
title: Design SaturationPicker primitive
status: scrapped
type: task
priority: normal
created_at: 2026-05-17T06:30:44Z
updated_at: 2026-05-17T19:06:45Z
parent: ps-udt1
---

## Goal

Design the SaturationPicker primitive: pick a member's saturation (elaboration) level — 4 known kinds (fragment, functional-fragment, partially-elaborated, highly-elaborated) plus optional user-defined custom level. Returns a `SaturationLevel` discriminated union with `kind`. Only visible when the system has `saturationLevelsEnabled` per features.md §1.

## Required output

- [ ] `docs/design-system/preview/components-saturation-picker.html` showing variants (4 well-known options, with custom-level affordance, with explainer popover) and required states
- [ ] Spec doc per SKILL.md §8 (term explainer copy per level; per-system enablement check)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md §1 saturation levels

## Out of scope

- RN code (M11), screen-level integration (Member management beans)

## Reasons for Scrapping

Re-audit round 2 (2026-05-17): the audit misread the requirement. The
"saturation" field is not color saturation — it does not need its own
picker. No new design work is required.
