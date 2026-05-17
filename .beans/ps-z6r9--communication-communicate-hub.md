---
# ps-z6r9
title: "Communication: Communicate hub"
status: todo
type: feature
created_at: 2026-05-17T06:38:34Z
updated_at: 2026-05-17T06:38:34Z
parent: ps-5fc5
---

## Goal

Design the Communicate hub — primary tab landing for chat, board, notes, polls, acknowledgements. Surfaces unread counts + latest activity per sub-area.

## Surfaces

- Communicate hub: `(app)/(tabs)/communicate/index.tsx`

## Required states per surface

- default (all 5 sub-areas with activity), empty per sub-area, unread-counts on each, with-mandatory-ack-pinned-top, offline, loading, error

## Mode notes

- Littles: only Chat and Board surfaces shown; Polls / Acks hidden
- High-contrast: unread-count badges use icon + count (not pure dot)

## Primitives required

- ScreenScaffold, Card (per sub-area tile), Badge, ListItem (recent activity), EmptyState (ps-ruwi), Banner (mandatory ack notice)

## Data refs (informational)

- `apps/api/src/trpc/routers/channel.ts` unread summary
- `apps/api/src/trpc/routers/board-message.ts` recent
- `apps/api/src/trpc/routers/note.ts` recent
- `apps/api/src/trpc/routers/poll.ts` open
- `apps/api/src/trpc/routers/acknowledgement.ts` pending

## Required output

- [ ] docs/design-system/preview/comm-hub.html with all states
- [ ] Rationale on tile order (most-recent vs most-active vs alphabetical)

## Out of scope

- RN code (M11), data wiring (M12), individual sub-area screens (separate beans)
