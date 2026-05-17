---
# ps-4yum
title: "Fronting: Reports — list + config create/edit + generate"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T05:51:00Z
updated_at: 2026-05-17T07:42:01Z
parent: ps-5920
blocked_by:
  - ps-udt1
---

## Goal

Design the fronting report system: list of saved report configs, create/edit config form, generate flow (client-side generation since server is encryption-blind).

## Surfaces

- Report list: `(app)/fronting/reports/index.tsx` — saved FrontingReport configs.
- Report config create/edit: `(app)/fronting/reports/new.tsx`, `[id]/edit.tsx` — name, scope (members + bucket filter), date range, format (PDF / CSV / share-friendly).
- Report generate: `(app)/fronting/reports/[id]/generate.tsx` — initiates client-side generation with progress and download.

## Required states per surface

- list: empty, populated, archived view
- config form: valid, invalid, submitting, conflict
- generate: queued, generating (with progress), ready (download CTA), error (retry CTA)

## Mode notes

- Client-side generation can be slow on lower-end devices (littles target audience); progress indicator must be clear.
- Reduced-motion: spinner replaces progress animation. Static mode: bar with no transition.

## Primitives required

- ListItem
- FAB (add new)
- TextField (report name)
- DateRangePicker
- MultiMemberPicker (scope filter)
- BucketPicker (scope filter)
- ProgressBar (generation)
- EmptyState
- Dialog (delete config — DestructiveConfirmDialog variant)
- Button (download, share)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-report.ts` — list, get, create, update, delete (generation happens client-side; no server endpoint)

## Required output

- [ ] docs/design-system/preview/fronting-reports.html with all states
- [ ] Layout / interaction rationale including the client-side generation UX decision

## Out of scope

- RN code (M11), data wiring (M12), mode coverage (Phase 3 sweep), actual report content layout (separate bean: "Fronting history report content design" under M13 ancillary).
