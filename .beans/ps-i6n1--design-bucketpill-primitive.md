---
# ps-i6n1
title: Design BucketPill primitive
status: todo
type: task
created_at: 2026-05-17T06:29:14Z
updated_at: 2026-05-17T06:29:14Z
parent: ps-udt1
---

## Goal

Design the BucketPill primitive: small visual privacy-bucket indicator — color dot + name + optional friend-count hint. Used inline on member detail, fronting session header, bucket selection sheets. Distinct from the BucketPicker primitive (which selects); BucketPill displays one assigned bucket.

## Required output

- [ ] `docs/design-system/preview/components-bucket-pill.html` showing variants (single, stacked-multi-pill row, with-friend-count, with-untagged-warning) and required states
- [ ] Spec doc per SKILL.md §8 (fail-closed rule: untagged content displays a "Private" pill, not absence)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`, `tokens/radii.json`
- Reference: GOVERNANCE.md §5b privacy-buckets canonical rules, `patterns.html` "Privacy buckets" pattern

## Out of scope

- RN code (M11), screen-level integration (Privacy & Social beans)
