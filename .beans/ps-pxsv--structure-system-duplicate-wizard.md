---
# ps-pxsv
title: "Structure: System duplicate wizard"
status: todo
type: feature
created_at: 2026-05-17T06:43:36Z
updated_at: 2026-05-17T06:43:36Z
parent: ps-7wf6
---

## Goal

Design the system duplicate wizard — multi-step flow to duplicate the current system to a new system under the same account, with element-selection at each step.

## Surfaces

- Wizard: `(app)/system/duplicate.tsx` (multi-step within)

## Required states per surface

- step 1 (name + nomenclature pick): empty/populated, invalid (name conflict)
- step 2 (element selection): toggle per category — members, custom fronts, groups, structure entities, fields, snapshots, innerworld, fronting history (with size hints per category)
- step 3 (bucket assignment): per-bucket include/exclude
- step 4 (confirm + estimated time): summary view
- duplicating: progress per category
- success: redirect to new system

## Mode notes

- Littles: hidden entirely
- Reduced-motion: progress per category as static count
- Static: bar with no transition

## Primitives required

- WizardStepper (pattern, ps-rhno), TextField, RadioGroup (nomenclature), Switch (per-category), KeyValueRow (ps-5lr6, size hints), BucketPicker (ps-s9r6), ProgressBar (ps-3m01), Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/system.ts` duplicate endpoint with options

## Required output

- [ ] docs/design-system/preview/structure-system-duplicate.html with all steps + states
- [ ] Rationale on the element-selection grouping (per-category vs per-entity-type)

## Out of scope

- RN code (M11), data wiring (M12), the WizardStepper pattern (Phase 0)
