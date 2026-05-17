---
# ps-zx2p
title: "Auth: Sign-in flow"
status: todo
type: feature
created_at: 2026-05-17T06:33:09Z
updated_at: 2026-05-17T06:33:09Z
parent: ps-nwju
---

## Goal

Design the sign-in surface and its quick-unlock variants (biometric prompt if previously enrolled, "use recovery key instead" link, "use another device" link).

## Surfaces

- Sign-in: `(auth)/login.tsx`
- Biometric quick-unlock: inline within sign-in when enrolled

## Required states per surface

- idle, submitting, key-deriving (Argon2id local), error (invalid creds, throttled, network), 2-step (account locked → recover via PIN/recovery), biometric prompt visible

## Mode notes

- Littles: simplified — no biometric, no recovery alternates, just email/password
- High-contrast: error states use icon + label (not color-only)

## Primitives required

- ScreenScaffold, TextField, Button, Banner (error), LoadingOverlay (key derive), Switch (show password)

## Data refs (informational)

- REST `/v1/auth/login` (auth predates tRPC session)
- Local Argon2id key derivation

## Required output

- [ ] docs/design-system/preview/auth-sign-in.html with all states
- [ ] Rationale for the "Unlocking your data…" indeterminate state copy

## Out of scope

- RN code (M11), data wiring (M12), mode coverage (Phase 3)
