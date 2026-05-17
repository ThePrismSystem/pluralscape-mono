---
# ps-j1wk
title: "Cross-cutting: Confirmation + destructive-confirm dialogs"
status: todo
type: feature
created_at: 2026-05-17T06:50:29Z
updated_at: 2026-05-17T06:50:29Z
parent: ps-k8mz
---

## Goal

Design the two confirmation dialog variants per GOVERNANCE.md §6 destructive tiers: standard confirm (reversible action) and destructive confirm (irreversible — requires typed match or held-button gesture).

## Surfaces

- Standard confirm dialog (title, body, cancel + confirm buttons).
- Destructive confirm dialog (title, body, danger affordance, typed-match input OR held-button gesture, cancel + destroy buttons).
- Destructive confirm with dependent-blocker copy (e.g., delete member with active fronts → 409 with link to dependents).

## Required states per surface

- Default.
- Typing in-progress (destructive — match not yet satisfied).
- Match satisfied (destructive — destroy button enabled).
- Holding-button progress (destructive variant 2).
- Submitting (button disabled + spinner).
- Error returned (inline error region above buttons).

## Mode notes

- Default mode only for this bean.
- Holding-button variant must have a static-mode fallback (typed match).

## Primitives required

- Dialog primitive (modal overlay + focus trap).
- Button + danger variant.
- Text input.
- Held-button progress ring.

## Data refs (informational)

- GOVERNANCE.md §6 destructive tiers.
- packages/api-client error codes for 409 dependent-blocker.

## Required output

- HTML mockup of all 3 variants × 6 states in docs/design-system/preview/cross-cutting/confirm-dialogs.html.
- Decision notes inline: which gesture for which destructive class.

## Out of scope

- RN implementation (M11).
- Action wiring (M12).
