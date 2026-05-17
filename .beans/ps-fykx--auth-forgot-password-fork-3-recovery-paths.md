---
# ps-fykx
title: "Auth: Forgot password fork + 3 recovery paths"
status: todo
type: feature
created_at: 2026-05-17T06:33:29Z
updated_at: 2026-05-17T06:33:29Z
parent: ps-nwju
---

## Goal

Design the forgot-password entry fork and its three downstream paths: recovery key entry, device-transfer initiate, and data-loss confirmation.

## Surfaces

- Fork entry: `(auth)/forgot/index.tsx`
- Recovery-key entry: `(auth)/forgot/recovery-key.tsx`
- Device-transfer initiate: `(auth)/forgot/device-transfer/initiate.tsx`
- Data-loss confirmation: `(auth)/forgot/data-loss.tsx`

## Required states per surface

- fork: pick-path idle, hovering option (web), expanded explainer
- recovery-key entry: idle, validating, decrypted (set new password), submitting, error (invalid key)
- device-transfer initiate: generating-code, awaiting-approval (countdown), approved, expired (5min TTL), denied
- data-loss: warning, typed-confirm ("DELETE MY DATA"), final-warning, submitting

## Mode notes

- Littles: data-loss path hidden (safety — destructive); fork shows only recovery-key + device-transfer options
- High-contrast: countdown / error states use icon + label

## Primitives required

- ScreenScaffold, Button, RecoveryKeyField (ps-o1zp), TextField (typed-confirm), Banner, DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- REST recovery-key challenge endpoint
- `apps/api/src/trpc/routers/account.ts` deviceTransfer subrouter

## Required output

- [ ] docs/design-system/preview/auth-forgot-password.html with all surfaces + states
- [ ] Rationale on the data-loss copy (must be unmistakable per ADR 011)

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3 sweep)
