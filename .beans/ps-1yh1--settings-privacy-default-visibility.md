---
# ps-1yh1
title: "Settings: Privacy & default-visibility"
status: todo
type: feature
created_at: 2026-05-17T06:46:21Z
updated_at: 2026-05-17T06:46:21Z
parent: ps-6a3x
---

## Goal

Design the privacy & default-visibility settings — fail-closed defaults per entity type, default bucket assignment for new entities, anti-enumeration toggles.

## Surfaces

- Privacy & defaults: `(app)/settings/privacy.tsx`

## Required states per surface

- default with section per entity type (members, custom fronts, groups, fronting sessions, journal, wiki, channels), each with default-bucket selector + "private by default" Switch, with-anti-enumeration-toggles section, save / reset affordances

## Mode notes

- Littles: simplified — single "Who can see your things?" preset pick (private / trusted friends / everyone)
- High-contrast: per-section card uses border + label

## Primitives required

- ScreenScaffold, Section (per entity type), Switch, BucketPicker (ps-s9r6), Banner, Button, KeyValueRow (ps-5lr6)

## Data refs (informational)

- `apps/api/src/trpc/routers/system.ts` settings.privacy

## Required output

- [ ] docs/design-system/preview/settings-privacy-defaults.html with all states
- [ ] Rationale on the preset-vs-granular UX trade

## Out of scope

- RN code (M11), data wiring (M12)
