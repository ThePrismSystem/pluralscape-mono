---
# ps-imfd
title: "Settings: Data export hub"
status: todo
type: feature
created_at: 2026-05-17T06:47:24Z
updated_at: 2026-05-17T06:47:24Z
parent: ps-6a3x
---

## Goal

Design the data export hub — pick what to export (whole system, bucket-scoped, single member subtree), pick format (JSON / SP-compatible / PK-compatible / PDF report), produce + download.

## Surfaces

- Export hub: `(app)/settings/data/export.tsx`

## Required states per surface

- idle (pick scope + format + bucket filter), with-preview-of-manifest, with-warning-if-includes-sensitive, generating (with progress), ready (download + share), error (with retry), success-history

## Mode notes

- Littles: hidden entirely
- High-contrast: format tiles use icon + label

## Primitives required

- ScreenScaffold, RadioGroup (scope, format), BucketPicker (ps-s9r6), KeyValueRow (ps-5lr6, manifest), ProgressBar (ps-3m01), Button (download / share), Banner (sensitive warning), EmptyState (ps-ruwi)

## Data refs (informational)

- Client-side generation (T1 encrypted; server cannot decrypt)
- `apps/api/src/trpc/routers/account.ts` export-history

## Required output

- [ ] docs/design-system/preview/settings-data-export.html with all states
- [ ] Rationale on format-pick UX

## Out of scope

- RN code (M11), data wiring (M12), the actual export generation
