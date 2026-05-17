---
# ps-i6n1
title: Design BucketPill primitive
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:29:14Z
updated_at: 2026-05-17T08:50:23Z
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

## Scope clarification (2026-05-17)

Re-audit (ps-sg8k) found that `PrivacyBucket.jsx` (the bucket editor)
already exists, but BucketPill is a distinct primitive: the compact
chip-form representation of a bucket assignment, used in:

- Content metadata rows (e.g., "Visible to: Close friends, Strangers")
- BucketPicker (ps-s9r6) selection state — picked buckets render as pills
- KeyValueRow value cells where the value is a list of buckets

BucketPill is NOT the editor and should not be confused with PrivacyBucket.jsx.
It's a tiny pill with the bucket name, optional audience-count badge, and
a fail-closed visual treatment for the special "Nobody" bucket.

Bean kept. Design produces `components-bucket-pill.html` with the 8 states
and 4 mode variants per SKILL.md §7-8.
