---
# ps-manc
title: "Settings: Theme & appearance"
status: todo
type: feature
created_at: 2026-05-17T06:45:58Z
updated_at: 2026-05-17T06:45:58Z
parent: ps-6a3x
---

## Goal

Design the theme & appearance settings — accommodation mode pick (default / static / reduced-motion / high-contrast / littles), accent-color override (within brand palette), font-scale slider, density toggle.

## Surfaces

- Theme & appearance: `(app)/settings/appearance.tsx`

## Required states per surface

- default (current selections + preview tile), mode pick with-preview (live), accent-color override with-preview, font-scale slider with-preview, density toggle (regular / dense), with-save indicator (auto on change), with-reset-to-default affordance

## Mode notes

- Littles: littles mode pick locked on; font scale + accent override hidden
- High-contrast: mode tiles use icon + label (not color-only)

## Primitives required

- ScreenScaffold, RadioGroup (mode pick), ColorSwatchPicker (accent), Slider (font scale), Switch (density), Card (live preview tile), Button (reset), KeyValueRow (ps-5lr6)

## Data refs (informational)

- Local app settings (not network)
- `apps/api/src/trpc/routers/system.ts` settings.theme (persisted for cross-device sync)

## Required output

- [ ] docs/design-system/preview/settings-theme.html with all states
- [ ] Rationale on live-preview surface (always visible vs on-tap)

## Out of scope

- RN code (M11), data wiring (M12), the actual mode tokens (already exist in `packages/design-system`)
