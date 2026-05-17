---
# ps-ag15
title: "Settings: Nomenclature editor"
status: todo
type: feature
created_at: 2026-05-17T06:45:51Z
updated_at: 2026-05-17T06:45:51Z
parent: ps-6a3x
---

## Goal

Design the per-system nomenclature editor — every term in features.md (System, Member, Fronting, Switch, Co-fronting, Headspace, Host, Structure, Dormancy, Body, Amnesia, Saturation) has an editable override, organized by category.

## Surfaces

- Nomenclature: `(app)/settings/system/nomenclature.tsx`

## Required states per surface

- default (all canonical terms with overrides visible), with-preset-pick (alters / headmates / parts / custom), per-term-edit (with conflict warning if term collides), submitting, success, with-undo affordance after save

## Mode notes

- Littles: simplified — only "What do you call yourselves?" single term editable
- High-contrast: per-row form uses border + label

## Primitives required

- ScreenScaffold, RadioGroup (preset pick), TextField (per-term override), Section (term categories), KeyValueRow (ps-5lr6), Banner (preview applied), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/system.ts` nomenclature get, update

## Required output

- [ ] docs/design-system/preview/settings-nomenclature.html with all states
- [ ] Rationale on preset-vs-custom UX

## Out of scope

- RN code (M11), data wiring (M12), the per-term application across the app (rendered via i18n at runtime)
