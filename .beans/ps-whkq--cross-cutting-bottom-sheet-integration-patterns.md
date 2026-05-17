---
# ps-whkq
title: "Cross-cutting: Bottom-sheet integration patterns"
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

Design the canonical bottom-sheet integration patterns showing how primitives compose into sheet layouts: form sheet, action sheet, picker sheet, scrollable detail sheet.

## Surfaces

- Action sheet (list of buttons).
- Form sheet (single-step form).
- Picker sheet (single/multi select).
- Scrollable detail sheet (member detail summary, settings sub-page).
- Half-sheet vs full-sheet snap points.

## Required states per surface

- Default.
- Snap to half.
- Snap to full.
- Keyboard open (form sheet only).
- Submitting.
- Error.

## Mode notes

- Default mode only.
- Static mode: sheet renders as full-page modal — noted but not designed here.

## Primitives required

- Bottom-sheet primitive.
- All form primitives (input, select, button, switch, textarea).
- Scrollable list primitive.

## Data refs (informational)

- N/A — pattern catalog only.

## Required output

- HTML mockup of all 4 sheet types × snap states in docs/design-system/preview/cross-cutting/bottom-sheets.html.
- Decision notes: snap point %, drag-handle ergonomics, dismiss gesture.

## Out of scope

- RN implementation (M11).
- Per-domain sheet content (lives with the owning screen bean).
