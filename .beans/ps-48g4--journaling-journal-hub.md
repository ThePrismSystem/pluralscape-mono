---
# ps-48g4
title: "Journaling: Journal hub"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:44:09Z
updated_at: 2026-05-17T07:42:01Z
parent: ps-djgs
blocked_by:
  - ps-5920
---

## Goal

Design the Journal hub — landing for personal entries + collaborative wiki, with recent activity summary.

## Surfaces

- Journal hub: `(app)/journal/index.tsx`

## Required states per surface

- default (with both sections populated), empty per section, with-search affordance, with-fronting-context indicator (if currently fronting), error

## Mode notes

- Littles: simplified — single "My journal" entry only; wiki hidden
- High-contrast: section cards use border-strong

## Primitives required

- ScreenScaffold, Card (section tile), Badge, ListItem (recent activity), FrontingChip (ps-458i, current-fronter context), EmptyState (ps-ruwi)

## Data refs (informational)

- `apps/api/src/trpc/routers/journal.ts` recent entries, recent wiki pages
- `apps/api/src/trpc/routers/fronting-session.ts` activeFronters (context)

## Required output

- [ ] docs/design-system/preview/journal-hub.html with all states
- [ ] Rationale on the journal-vs-wiki split

## Out of scope

- RN code (M11), data wiring (M12), individual sub-area screens (separate beans)
