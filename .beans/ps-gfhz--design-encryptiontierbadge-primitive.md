---
# ps-gfhz
title: Design EncryptionTierBadge primitive
status: scrapped
type: task
priority: normal
created_at: 2026-05-17T06:27:26Z
updated_at: 2026-05-17T08:50:22Z
parent: ps-udt1
---

## Goal

Design the EncryptionTierBadge primitive: small lock indicator with T1 / T2 / T3 variants. Tap or long-press reveals an explainer popover describing what the tier means for visibility (T1 zero-knowledge, T2 per-bucket, T3 server-visible metadata).

## Required output

- [ ] `docs/design-system/preview/components-encryption-tier.html` showing T1 / T2 / T3 variants with the explainer popover open
- [ ] Spec doc per SKILL.md §8

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/spacing.json`
- Reference: features.md encryption tier definitions; `docs/design-system/uploads/SCREENS.md` §12.7

## Out of scope

- RN code (M11), screen-level integration (Phase 1 / 2)

## Reasons for Scrapping

Re-audit (2026-05-17) found this bean contradicts the existing design system.
`docs/design-system/preview/components-display.html:320` states explicitly:
"We never display a 'T1/T2' tier label — every field is T1; T2 is just the
privacy-bucket-keyed subset and is functionally still T1 to the user."

The only encryption-tier indicator that surfaces in UI is the T3 (plaintext)
tag, which is already designed in two places:

- `components-feedback.html:298-318` — Popover form with "Server-visible
  metadata" explainer
- `components-display.html:316-318` — inline `plaintext` tag in KeyValueRow

No new badge is needed.
