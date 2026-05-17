---
# ps-47zn
title: "Cross-cutting: Image picker launcher + permission flow"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:50:29Z
updated_at: 2026-05-17T07:42:01Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Design the image picker launcher used across avatar upload, journal attachments, member proxy images: action sheet → permission prompt → picker → cropper → upload progress.

## Surfaces

- Launcher action sheet (camera / photo library / cancel).
- Permission-pre-prompt (rationale before OS prompt).
- Permission-denied empty state with deep-link to OS settings.
- Cropper (1:1 square + freeform).
- Upload progress overlay.
- Upload error.

## Required states per surface

- Default.
- Permission pending.
- Permission granted.
- Permission denied permanently.
- Crop in-progress.
- Uploading.
- Upload error with retry.

## Mode notes

- Default mode only.
- High-contrast: cropper handles must remain visible — noted for Phase 3.

## Primitives required

- Bottom-sheet (launcher).
- Permission-explainer card.
- Image cropper primitive.
- Progress overlay.

## Data refs (informational)

- packages/storage upload pipeline.
- E2E encryption handled transparently; no UI surface.

## Required output

- HTML mockup of the full flow in docs/design-system/preview/cross-cutting/image-picker.html.
- Decision notes: pre-prompt rationale copy, retry behavior.

## Out of scope

- RN implementation (M11).
- Native plugin selection (M11).
