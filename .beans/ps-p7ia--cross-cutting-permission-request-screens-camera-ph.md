---
# ps-p7ia
title: "Cross-cutting: Permission request screens (camera, photos, notifications, biometrics)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T07:42:07Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Design the pre-OS-prompt rationale screens for the four permission surfaces: camera, photo library, push notifications, biometrics (face/touch).

## Surfaces

- Camera rationale (used for: avatar photo).
- Photo library rationale (used for: avatar / journal attachment).
- Push notifications rationale (used for: switch reminders, comm DM, friend requests).
- Biometric rationale (used for: foreground re-auth, secret-key unlock).

## Required states per surface

- Default rationale (pre-prompt).
- Awaiting OS prompt.
- Granted confirmation.
- Denied with deep-link to OS settings.
- Permanently-denied state.

## Mode notes

- Default mode only.
- Static mode: same screens, no animation — noted for Phase 3.

## Primitives required

- Full-screen rationale card.
- Button + secondary button.
- Icon (permission-type illustration).

## Data refs (informational)

- N/A — UI-only.

## Required output

- HTML mockup of all 4 surfaces × 5 states in docs/design-system/preview/cross-cutting/permissions.html.
- Decision notes: rationale copy register per permission.

## Out of scope

- RN implementation (M11).
- Native plugin selection.
