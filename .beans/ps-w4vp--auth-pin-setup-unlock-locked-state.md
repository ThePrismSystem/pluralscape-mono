---
# ps-w4vp
title: "Auth: PIN setup + unlock + locked state"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:33:53Z
updated_at: 2026-05-17T07:42:09Z
parent: ps-nwju
blocked_by:
  - ps-5920
---

## Goal

Design the PIN lock surfaces — set new PIN, enter PIN to unlock at app foreground, account-locked state after too many failures.

## Surfaces

- PIN setup: `(auth)/pin/setup.tsx` and reached from Settings → Security
- PIN unlock: `(lock)/pin.tsx`
- Account locked: `(auth)/locked.tsx`

## Required states per surface

- setup: idle, entering, confirming, mismatch, success, cancel
- unlock: idle, entering (digit-by-digit feedback), submitting, error (wrong PIN with attempt-count), throttle warning
- locked: countdown to retry, recovery alternates listed (use recovery key, use another device)

## Mode notes

- Littles: PIN setup hidden if account-type is "viewer"; unlock simplified copy ("Your PIN")
- High-contrast: filled / empty dot indicators use shape difference (filled circle vs ring) not just color
- Reduced-motion: shake-on-error animation collapses to brief tone

## Primitives required

- PinPad (existing in components-inputs.html), Banner, Button, KeyValueRow (attempt count)

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` PIN sub-resource (set, verify, remove)

## Required output

- [ ] docs/design-system/preview/auth-pin-lock.html with all surfaces + states
- [ ] Copy on lockout recovery options

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3 sweep)
