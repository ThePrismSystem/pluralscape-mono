---
# ps-8j2i
title: "Cross-cutting: Encryption tier badge + explainer"
status: todo
type: feature
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T06:51:15Z
parent: ps-k8mz
---

## Goal

Design the encryption tier badge surfaced on data-bearing entities (member, journal, comm message, etc.) plus the explainer screen reachable from the badge.

## Surfaces

- Inline badge (E2E / TLS-only / unencrypted) on entity headers.
- Tap-target → explainer card (what the tier means, who can read, where keys live).
- Full explainer screen (linked from settings → help).
- Tier-downgrade warning toast (rare path).

## Required states per surface

- E2E encrypted (default for member/journal/comm).
- TLS-only (server can read — applies to non-secret metadata).
- Unencrypted (applies to public profile, opted-in).
- Mixed (entity contains fields in multiple tiers).

## Mode notes

- Default mode only.
- High-contrast: tier color tokens must remain distinguishable — noted for Phase 3.

## Primitives required

- Badge primitive.
- Card.
- Icon (lock / shield / open variants).

## Data refs (informational)

- packages/crypto bucket/tier model.
- packages/types entity tier classifications.

## Required output

- HTML mockup of badge + explainer in docs/design-system/preview/cross-cutting/encryption-tier.html.
- Decision notes: per-tier color, copy register, where badge appears vs. hides.

## Out of scope

- RN implementation (M11).
- Settings → Privacy & default-visibility (lives in ps-1yh1).
