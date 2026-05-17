---
# ps-491k
title: "Home: Notifications inbox"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:35:38Z
updated_at: 2026-05-17T07:42:01Z
parent: ps-divy
blocked_by:
  - ps-5920
---

## Goal

Design the Notifications inbox — system-side surface for received push notifications (friend front alerts, mandatory acknowledgements, device-transfer requests, webhook failures, recovery-key reminders).

## Surfaces

- Notifications: `(app)/notifications.tsx`

## Required states per surface

- default (mixed-kind list), empty (no notifications ever), filtered (by-kind chip), unread-only toggle, archived view, error, loading

## Mode notes

- Littles: hides device-transfer + webhook-failure notification kinds
- High-contrast: per-kind icon is the disambiguator (color tier is supplemental)

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), ListItem, Badge, Chip (filter), EmptyState (ps-ruwi)
- LifecycleEventChip (ps-v3e9) for system-event notifications
- BucketPill (ps-i6n1) for friend-related notifications

## Data refs (informational)

- `apps/api/src/trpc/routers/notification-config.ts`
- SSE notification stream (local subscription)

## Required output

- [ ] docs/design-system/preview/home-notifications.html with all states
- [ ] Rationale on notification grouping rules (per-kind, per-time-bucket)

## Out of scope

- RN code (M11), data wiring (M12), notification-config screen (Privacy & Social bean)
