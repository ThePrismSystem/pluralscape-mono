---
# ps-igb4
title: "Communication: Channel composer + proxy switch fly-out + message actions sheet"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:38:54Z
updated_at: 2026-05-17T07:42:05Z
parent: ps-5fc5
blocked_by:
  - ps-5920
---

## Goal

Design the composer surfaces inside a channel — message compose with proxy switching, the rapid proxy-switch fly-out (inline), and the message actions sheet (edit, delete, react, copy, reply).

## Surfaces

- Composer: footer of channel detail screen
- Rapid proxy switch fly-out: inline within composer when proxy chip is tapped
- Message actions: `(sheets)/message-actions.tsx`

## Required states per surface

- composer: idle, typing, with-mention-picker open, with-formatting-toolbar open, with-attachment-pending, send-disabled (empty), submitting, offline-queued
- proxy fly-out: idle (current proxy + grid of options), with-recent-proxies, with-search, error-no-proxies
- actions: per-message-state (own/other, recent/old, archived), reactions row, edit affordance, delete affordance, copy affordance, reply affordance

## Mode notes

- Littles: proxy switching hidden (default sender = current fronter); message actions limited to copy + reply
- High-contrast: proxy chip uses icon + label

## Primitives required

- RichTextField (ps-9yhh), ProxyChip (ps-jtvw), MemberPicker (ps-djqo), BottomSheet, Button, IconButton, EmojiPicker (existing), Banner (offline notice), DestructiveConfirmDialog (ps-bydy)

## Data refs (informational)

- `apps/api/src/trpc/routers/message.ts` create, update, delete
- proxy state is local + per-channel preference

## Required output

- [ ] docs/design-system/preview/comm-composer-proxy.html with all surfaces + states
- [ ] Rationale on the rapid-proxy fly-out placement (above vs below the composer)

## Out of scope

- RN code (M11), data wiring (M12), the channel list / detail screens (separate bean)
