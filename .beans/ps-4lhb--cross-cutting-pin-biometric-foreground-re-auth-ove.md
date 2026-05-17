---
# ps-4lhb
title: "Cross-cutting: PIN / biometric foreground re-auth overlay"
status: todo
type: feature
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T06:51:15Z
parent: ps-k8mz
---

## Goal

Design the foreground re-authentication overlay shown when app resumes from background after the configured timeout.

## Surfaces

- Re-auth overlay (PIN input).
- Re-auth overlay (biometric prompt — face / touch).
- Re-auth fallback (biometric failed → PIN).
- Re-auth lockout (N failed attempts → cooldown).

## Required states per surface

- Default (PIN: empty input).
- Typing PIN.
- Biometric pending.
- Biometric succeeded.
- Biometric failed → PIN fallback.
- Lockout countdown.
- Lockout cleared.

## Mode notes

- Default mode only.
- Static mode: no biometric animation — noted for Phase 3.

## Primitives required

- Modal overlay (full-screen).
- PIN input primitive.
- Biometric prompt placeholder.
- Countdown timer.

## Data refs (informational)

- Settings → Privacy (lock timeout config — ps-1yh1).
- packages/crypto secret-key unlock flow.

## Required output

- HTML mockup of all states in docs/design-system/preview/cross-cutting/reauth-overlay.html.
- Decision notes: lockout policy (attempts × cooldown).

## Out of scope

- RN implementation (M11).
- Secret-key derivation UI (lives in onboarding ps-\* auth bean).
