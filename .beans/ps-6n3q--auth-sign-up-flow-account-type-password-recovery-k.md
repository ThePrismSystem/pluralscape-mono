---
# ps-6n3q
title: "Auth: Sign-up flow (account-type + password + recovery key)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:33:20Z
updated_at: 2026-05-17T07:42:02Z
parent: ps-nwju
blocked_by:
  - ps-5920
---

## Goal

Design the complete sign-up flow: account-type pick (system vs viewer per ADR 021) → master password create with strength meter → terms ack → recovery key ceremony (reveal + confirm + initial reminder schedule).

## Surfaces

- Account-type pick: `(auth)/register/account-type.tsx`
- Password create: `(auth)/register/password.tsx`
- Terms ack: inline within password screen or sibling
- Recovery key reveal: `(auth)/register/recovery.tsx`
- Recovery key confirm challenge: `(auth)/register/recovery-confirm.tsx`

## Required states per surface

- account-type: idle, system selected, viewer selected, with "What's the difference?" tooltip
- password: weak / fair / strong, confirm-mismatch, terms-unchecked, submitting
- reveal: revealed, ack-pending (3 checkboxes), all-acked
- confirm: idle, mismatch, success, skip-dialog visible

## Mode notes

- Littles: account-type pick hidden (default to system); password screen simplified language ("a key word only you know"); recovery key ceremony preserved (safety-critical)
- High-contrast / static: strength meter uses bar segments + text label (not color-only)

## Primitives required

- WizardStepper (pattern, ps-rhno)
- RecoveryKey ceremony (pattern, ps-472d)
- RecoveryKeyDisplay (ps-xthc), RecoveryKeyField (ps-o1zp)
- TextField, Button, Switch, Checkbox, Banner

## Data refs (informational)

- REST `/v1/auth/register`
- Client-side recovery key generation before POST

## Required output

- [ ] docs/design-system/preview/auth-sign-up.html with all surfaces + states
- [ ] Rationale notes on hard-ack copy per GOVERNANCE.md §6 / §7

## Out of scope

- RN code (M11), data wiring (M12), mode coverage variants beyond above (Phase 3 sweep), the recovery key ceremony pattern itself (Phase 0)
