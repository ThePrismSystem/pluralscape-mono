---
# ps-r7ox
title: "Privacy: Friend codes (generate + list + redeem)"
status: todo
type: feature
created_at: 2026-05-17T06:41:25Z
updated_at: 2026-05-17T06:41:25Z
parent: ps-9xue
---

## Goal

Design the friend-code surfaces — generate a new XXXX-XXXX code, list active / archived codes, redeem an incoming code.

## Surfaces

- Generate: `(app)/privacy/friend-codes/new.tsx`
- List: `(app)/privacy/friend-codes/index.tsx`
- Redeem: `(app)/privacy/friend-codes/redeem.tsx`

## Required states per surface

- generate: with options (bucket auto-assign, code-purpose label), confirming, code-revealed (copy + share + QR), expired
- list: empty, with-active-codes, archived view, with-revoke affordance per code
- redeem: idle, code-entry, validating, matched (with friend preview), submitting, error (invalid, expired)

## Mode notes

- Littles: hidden
- High-contrast: code display monospace + segmented

## Primitives required

- ScreenScaffold, RecoveryKeyField (ps-o1zp, re-skinned for XXXX-XXXX code entry), Button, BucketPicker (ps-s9r6), TextField, Banner, EmptyState (ps-ruwi), QR code primitive (or inline-svg, NEW), Avatar (friend preview)

## Data refs (informational)

- `apps/api/src/trpc/routers/friend-code.ts` create, list, redeem, revoke, archive

## Required output

- [ ] docs/design-system/preview/privacy-friend-codes.html with all surfaces + states
- [ ] Rationale on QR code presentation (default on / off)

## Out of scope

- RN code (M11), data wiring (M12)
