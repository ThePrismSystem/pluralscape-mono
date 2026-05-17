---
# ps-m6ey
title: "Auth: Account management (email + password + recovery-key regen + deletion)"
status: todo
type: feature
created_at: 2026-05-17T06:34:22Z
updated_at: 2026-05-17T06:34:22Z
parent: ps-nwju
---

## Goal

Design the post-sign-in account management surfaces — email change with re-verify, password change, recovery-key regeneration (re-ceremony), and account deletion.

## Surfaces

- Email change: `(settings)/account/email/index.tsx` + verify `(settings)/account/email/verify.tsx`
- Password change: `(settings)/account/password.tsx`
- Recovery-key regenerate: `(settings)/account/recovery-key.tsx`
- Account deletion: `(settings)/account/delete.tsx`

## Required states per surface

- email change: idle, submitting, pending-verify-email-sent, verified, error
- password change: current+new+confirm valid/invalid, submitting, success, re-encrypt-pending
- recovery-key regen: warning, ack, regenerating, new-key reveal (re-ceremony), confirm-challenge, success
- account deletion: warning, typed-confirm, final-warning, purging (progress), completed-redirect-to-welcome

## Mode notes

- Littles: account deletion path requires switch out of Littles mode + parent re-auth
- High-contrast: all destructive states use icon + label

## Primitives required

- RecoveryKey ceremony pattern (ps-472d), RecoveryKeyDisplay (ps-xthc)
- TextField, Button, DestructiveConfirmDialog (ps-bydy), ProgressRing/Bar (ps-3m01), Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` (email change, password change, deletion, recovery-key regeneration)

## Required output

- [ ] docs/design-system/preview/auth-account-management.html with all surfaces + states
- [ ] Copy decisions for the four GOVERNANCE.md §6 destructive tier mappings

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3 sweep)
