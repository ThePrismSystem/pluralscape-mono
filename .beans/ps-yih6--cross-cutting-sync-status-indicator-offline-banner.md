---
# ps-yih6
title: "Cross-cutting: Sync status indicator + offline banner"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:50:29Z
updated_at: 2026-05-17T07:42:09Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Design the persistent sync indicator (header/footer chip) and the offline / sync-paused banner per offline-first architecture.

## Surfaces

- Header sync chip (synced / syncing / queued / offline / paused / error).
- Offline banner (top-of-screen, dismissible per session).
- Sync-paused banner (user paused — top-of-screen with resume button).
- Sync-error banner with retry + diagnostics link.

## Required states per surface

- Synced (default — minimal/hidden chrome).
- Syncing (animated indicator).
- Queued N changes (chip shows count).
- Offline.
- Paused (user-initiated).
- Error.

## Mode notes

- Default mode only.
- Reduced-motion: syncing animation freezes — noted for Phase 3.

## Primitives required

- Chip/badge primitive.
- Banner primitive.
- Icon (sync states).

## Data refs (informational)

- packages/sync state machine.
- Settings → Tools → sync diagnostics (ps-21dn).

## Required output

- HTML mockup of chip × 6 states + 3 banner variants in docs/design-system/preview/cross-cutting/sync-status.html.
- Decision notes: banner dismiss persistence rules.

## Out of scope

- RN implementation (M11).
- Sync engine UI (lives in Settings → Tools — ps-21dn).
