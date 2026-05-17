---
# ps-s9r6
title: Design BucketPicker primitive
status: todo
type: task
created_at: 2026-05-17T06:30:33Z
updated_at: 2026-05-17T06:30:33Z
parent: ps-udt1
---

## Goal

Design the BucketPicker primitive: privacy-bucket selection (single or multi). Distinct from BucketPill (display). Used everywhere a piece of data is bucket-scoped: member, custom field, fronting session, channel, board message, note, poll, friend assignment.

## Required output

- [ ] `docs/design-system/preview/components-bucket-picker.html` showing variants (single-pick, multi-pick with chips, with "+ create bucket" affordance, with untagged-warning explainer) and required states
- [ ] Spec doc per SKILL.md §8 (fail-closed messaging: pre-select "Private" if no buckets exist for the entity)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: GOVERNANCE.md §5b privacy primitive, features.md §4

## Out of scope

- RN code (M11), screen-level integration (Privacy & Social beans)
