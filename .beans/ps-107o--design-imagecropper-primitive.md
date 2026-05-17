---
# ps-107o
title: Design ImageCropper primitive
status: todo
type: task
created_at: 2026-05-17T06:28:13Z
updated_at: 2026-05-17T06:28:13Z
parent: ps-udt1
---

## Goal

Design the ImageCropper primitive: in-app crop and resize affordance for member avatars and gallery photos. Square + free-form crop, resize sliders, rotate. Loaded after ImagePickerLauncher returns a source. Required by features.md §1 "Image editing — built-in crop and resize when uploading avatars or gallery photos (no external tool needed)".

## Required output

- [ ] `docs/design-system/preview/components-image-cropper.html` showing variants (square crop, free-form, with rotate, with zoom) and states (loaded, cropping, applying, error)
- [ ] Spec doc per SKILL.md §8 (gesture handling: pinch-zoom, drag-pan, rotate-handle)

## Tokens / references

- Tokens: `tokens/colors.json`, `tokens/radii.json` (crop frame), `tokens/motion.json` (drag feedback)
- Reference: features.md §1

## Out of scope

- RN code (M11), screen-level integration (Member management beans)
