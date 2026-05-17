---
# ps-gi8z
title: "Privacy: Bucket export"
status: todo
type: feature
created_at: 2026-05-17T06:40:46Z
updated_at: 2026-05-17T06:40:46Z
parent: ps-9xue
---

## Goal

Design the bucket export flow — bundle bucket-scoped data for a friend (manifest counts + key grants per entity type).

## Surfaces

- Bucket export: `(app)/privacy/buckets/[bucketId]/export.tsx`

## Required states per surface

- idle (with manifest preview — counts per entity-type), generating (with progress), ready (with download + share affordances), error (with retry)

## Mode notes

- Littles: feature hidden
- Reduced-motion: progress animation replaced by static counter
- Static: progress bar with no transition

## Primitives required

- ScreenScaffold, KeyValueRow (ps-5lr6, manifest), Button, ProgressBar (ps-3m01), Banner, EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/bucket.ts` export endpoint + manifest counts

## Required output

- [ ] docs/design-system/preview/privacy-bucket-export.html with all states
- [ ] Rationale on the share-vs-download presentation

## Out of scope

- RN code (M11), data wiring (M12), client-side export generation logic
