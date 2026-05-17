---
# ps-icxe
title: "Auth: Device transfer approve modal"
status: todo
type: feature
created_at: 2026-05-17T06:33:44Z
updated_at: 2026-05-17T06:33:44Z
parent: ps-nwju
---

## Goal

Design the device-transfer approval modal (ADR 011 §Path 2) — invoked on an existing logged-in device when a new device initiates a transfer. Surfaces the pending code for side-by-side verification, with "This is me" and "I didn't request this" actions.

## Surfaces

- Approve modal: `(modals)/device-transfer/approve.tsx`

## Required states per surface

- prompt (verify code match), confirming, confirmed, denied, expired (5min TTL)
- background: triggered by push notification or in-app banner

## Mode notes

- High-contrast: code display monospace + segmented (not color-only emphasis)
- Static / reduced-motion: no countdown ring animation — text counter only
- Littles: hide this flow entirely (security-sensitive)

## Primitives required

- Dialog or BottomSheet (host), Button, RecoveryKeyField (re-skinned for 8-digit code), Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` deviceTransfer.approveDeviceTransfer

## Required output

- [ ] docs/design-system/preview/auth-device-transfer-approve.html with all states
- [ ] Copy decisions per GOVERNANCE.md §7 (warning if code doesn't match)

## Out of scope

- RN code (M11), data wiring (M12), the initiate side (covered by Auth: Forgot password)
