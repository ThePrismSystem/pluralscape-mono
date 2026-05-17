---
# ps-fyin
title: "Auth: Biometric enrollment + unlock prompt"
status: todo
type: feature
created_at: 2026-05-17T06:34:00Z
updated_at: 2026-05-17T06:34:00Z
parent: ps-nwju
---

## Goal

Design the biometric enrollment and unlock prompts. Native OS biometric APIs handle the actual auth — these screens explain, opt in, and surface the OS prompt.

## Surfaces

- Biometric enrollment: `(auth)/biometric/enroll.tsx`
- Biometric unlock: `(lock)/biometric.tsx`

## Required states per surface

- enroll: idle, OS-prompt-pending, success, denied, unavailable (no hardware / not enrolled in OS), skip
- unlock: prompt-pending, success (instant transition), failed, fallback-to-PIN

## Mode notes

- Littles: biometric flow hidden by default; opt-in only via parent/caregiver settings
- Static / reduced-motion: no pulsing-fingerprint animation

## Primitives required

- ScreenScaffold, Button, Banner, Icon (biometric kind: fingerprint, face, etc.)

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` biometric token enrollment endpoints

## Required output

- [ ] docs/design-system/preview/auth-biometric.html with all states
- [ ] Copy on what biometric means for security (does NOT replace master password)

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3 sweep)
