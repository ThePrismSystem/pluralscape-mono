---
# ps-8363
title: "Structure: Innerworld canvas + region/placer/edit sheets"
status: todo
type: feature
created_at: 2026-05-17T06:43:22Z
updated_at: 2026-05-17T06:43:22Z
parent: ps-7wf6
---

## Goal

Design the Innerworld 2D canvas — pan / zoom, drag-and-drop nodes, region overlays — plus the region create/edit sheet, the entity placer sheet, and the inline node edit popover.

## Surfaces

- Innerworld canvas: `(app)/structure/innerworld/index.tsx`
- Region create/edit: `(sheets)/innerworld-region.tsx`
- Entity placer: `(sheets)/innerworld-place.tsx`
- Inline node edit: popover within canvas

## Required states per surface

- canvas: empty (no entities placed), populated, with-region-overlay, with-selected-node, dragging-node, zoomed-out (overview), zoomed-in (detail), with-canvas-state-save indicator (auto vs manual), offline
- region sheet: name + color + gatekeeper-pick + access-rule (open vs gatekept), submitting
- placer sheet: pick kind (member / landmark / structure-entity), pick target, pick position (snap-to-grid optional)
- node edit popover: rename, color, image source override, link-to-structure-entity, delete

## Mode notes

- Littles: simplified — single-region "Headspace" only, no advanced canvas
- High-contrast: region overlays use pattern + label
- Reduced-motion: pan / zoom snap (no smooth transitions)

## Primitives required

- ScreenScaffold, Canvas primitive, InnerworldNode (ps-5iro), BottomSheet, TextField, ColorSwatchPicker, EmojiPicker, ImagePickerLauncher, MemberPicker (ps-djqo), EntityTypePicker (ps-gml0), Banner (offline), SyncIndicator (ps-gnkq), Button, Popover (ps-rgrw)

## Data refs (informational)

- `apps/api/src/trpc/routers/innerworld.ts` regions, entities, canvas-state, save

## Required output

- [ ] docs/design-system/preview/structure-innerworld.html with all surfaces + states
- [ ] Rationale on the snap-to-grid affordance and auto-save trigger threshold

## Out of scope

- RN code (M11), data wiring (M12), the InnerworldNode primitive (Phase 0)
