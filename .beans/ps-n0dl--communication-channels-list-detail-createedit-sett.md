---
# ps-n0dl
title: "Communication: Channels (list + detail + create/edit + settings)"
status: todo
type: feature
created_at: 2026-05-17T06:38:44Z
updated_at: 2026-05-17T06:38:44Z
parent: ps-5fc5
---

## Goal

Design the Channels surfaces — list with categories, channel detail (message stream), create/edit, and the channel settings sheet (rename, color, archive, delete).

## Surfaces

- Channel list: `(app)/communicate/channels/index.tsx`
- Channel detail: `(app)/communicate/channels/[channelId]/index.tsx`
- New: `(app)/communicate/channels/new.tsx`
- Edit: `(app)/communicate/channels/[id]/edit.tsx`
- Settings: `(sheets)/channel-settings.tsx`

## Required states per surface

- list: empty, categorized (with categories collapsed/expanded), filtered, archived view
- detail: empty stream, populated, loading-tail, oldest-message reached, error, with-mention-highlight, with-pinned-message-banner, currently-typing-indicator
- create/edit: empty/populated, invalid, submitting, conflict, with bucket assignment
- settings sheet: rename, color, emoji, archive, delete, member-mute, notification settings

## Mode notes

- Littles: simplified — no categories, no proxy switching, single all-members channel only
- High-contrast: per-channel color uses dot + label (not background fill)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (channel row), Accordion (ps-ecpl, for categories), FAB, EmptyState (ps-ruwi), Banner (pinned-message), BucketPicker (ps-s9r6), ColorSwatchPicker, EmojiPicker, BottomSheet, DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- `apps/api/src/trpc/routers/channel.ts` list, get, create, update, archive, delete
- `apps/api/src/trpc/routers/message.ts` listByChannel

## Required output

- [ ] docs/design-system/preview/comm-channels.html with all surfaces + states
- [ ] Rationale on category visualization

## Out of scope

- RN code (M11), data wiring (M12), the composer + actions sheet (separate bean)
