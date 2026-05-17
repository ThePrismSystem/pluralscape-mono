---
# ps-u28x
title: "Structure: Snapshots (list + detail + create confirm)"
status: todo
type: feature
created_at: 2026-05-17T06:43:11Z
updated_at: 2026-05-17T06:43:11Z
parent: ps-7wf6
---

## Goal

Design the system snapshot surfaces — list of point-in-time captures, detail viewer (read-only), create confirm modal.

## Surfaces

- Snapshot list: `(app)/structure/snapshots/index.tsx`
- Snapshot detail: `(app)/structure/snapshots/[id]/index.tsx`
- Create confirm: `(modals)/snapshot-create.tsx`

## Required states per surface

- list: empty, populated (with-creation-date sort), with-storage-warning if approaching quota, archived view, error
- detail: snapshot preview rendered as read-only-mini-app (members list, structure entities, innerworld state), with-export affordance, with-delete affordance
- create: confirm dialog with snapshot-includes summary, optional-label TextField, submitting, success

## Mode notes

- Littles: hidden
- High-contrast: snapshot date uses monospace numerals

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (snapshot tile), KeyValueRow (ps-5lr6), Dialog (create + delete confirm), DestructiveConfirmDialog (ps-bydy), Button, EmptyState (ps-ruwi), Banner (storage warning), Tabs (detail sub-views)

## Data refs (informational)

- `apps/api/src/trpc/routers/snapshot.ts` list, get, create, delete

## Required output

- [ ] docs/design-system/preview/structure-snapshots.html with all surfaces + states
- [ ] Rationale on detail-view layout (mirror current app vs custom layout)

## Out of scope

- RN code (M11), data wiring (M12), restoring from a snapshot (not supported — view-only per features.md §6)
