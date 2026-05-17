---
# ps-85ha
title: "Cross-cutting: Toast / snackbar feedback layer"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:50:29Z
updated_at: 2026-05-17T07:42:02Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Design the global toast/snackbar feedback layer: position rules, stacking behavior, action affordances, severity variants, dismissal.

## Surfaces

- Bottom-anchored toast (mobile primary).
- Top-anchored toast (web header context).
- Snackbar with action button (single action).
- Toast stack (multiple in-flight).

## Required states per surface

- Default (info).
- Success.
- Warning.
- Error (persistent until dismissed).
- With action.
- Dismissing animation.
- Stack-overflow (>3 toasts).

## Mode notes

- Default mode only.
- Reduced-motion variant noted but not designed here (Phase 3 sweep).

## Primitives required

- Toast primitive.
- Icon (severity glyph).
- Button (action).

## Data refs (informational)

- No tRPC routers — UI-only ephemeral state.

## Required output

- HTML mockup of all variants × states in docs/design-system/preview/cross-cutting/toast-snackbar.html.
- Decision notes: timeout per severity, stack cap.

## Out of scope

- RN implementation (M11).
- Telemetry / observability of toast events.
