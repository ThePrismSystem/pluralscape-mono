---
# ps-a2a6
title: "Settings: Data import (hub + SP wizard + PK wizard + job detail)"
status: todo
type: feature
created_at: 2026-05-17T06:47:18Z
updated_at: 2026-05-17T06:47:18Z
parent: ps-6a3x
---

## Goal

Design the data import surfaces — the hub (pick source: SP / PK), the SP import wizard, the PK import wizard, and the per-job detail (progress + result + conflict resolution).

## Surfaces

- Import hub: `(app)/settings/data/import.tsx`
- SP wizard: `(app)/settings/data/import/sp/index.tsx`
- PK wizard: `(app)/settings/data/import/pk/index.tsx`
- Job detail: `(app)/settings/data/import/[jobId].tsx`

## Required states per surface

- hub: default (with-active-job banner if in-progress), with-recent-imports list, error
- SP wizard: source pick (file upload vs API token), token entry (with-phishing-warning per import-sp hardening bean), preview-of-counts, dedup-options (against existing Pluralscape buckets), confirm + import, in-progress, complete
- PK wizard: source pick (file upload only — PK has no live API in scope), preview-of-counts, mapping-options, confirm + import, in-progress, complete
- job detail: live progress per category, conflict-resolution surfaces (one-by-one or batch-apply), result summary, retry-from-failed-chunk

## Mode notes

- Littles: import hidden entirely
- High-contrast: progress bars use border + label

## Primitives required

- ScreenScaffold, Card (source tile), WizardStepper (pattern, ps-rhno), TextField, Switch (per-mapping option), KeyValueRow (ps-5lr6), ProgressBar (ps-3m01), Banner (warnings), Button, EmptyState (ps-ruwi), DestructiveConfirmDialog (ps-bydy, cancel mid-import)
- ImportConflictResolver pattern (existing in patterns.html)

## Data refs (informational)

- `apps/api/src/trpc/routers/import-job.ts` create, list, get, cancel, retry
- `apps/api/src/trpc/routers/import-entity-ref.ts` conflict-resolution batch ops

## Required output

- [ ] docs/design-system/preview/settings-data-import.html with all surfaces + states
- [ ] Rationale on conflict-resolution UX (per-conflict review vs batch-apply)

## Out of scope

- RN code (M11), data wiring (M12), the actual import engines (already exist in `packages/import-*`)
