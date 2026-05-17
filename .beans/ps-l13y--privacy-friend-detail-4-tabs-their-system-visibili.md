---
# ps-l13y
title: "Privacy: Friend detail (4 tabs — their-system / visibility / notifications / buckets)"
status: todo
type: feature
created_at: 2026-05-17T06:41:10Z
updated_at: 2026-05-17T06:41:10Z
parent: ps-9xue
---

## Goal

Design the friend detail screen with 4 tabbed sub-views.

## Surfaces

- Friend detail: `(app)/privacy/friends/[friendId]/index.tsx` (visibility, default)
- Their-system tab: `(app)/privacy/friends/[friendId]/their-system.tsx`
- Visibility tab: `(app)/privacy/friends/[friendId]/visibility.tsx`
- Notifications tab: `(app)/privacy/friends/[friendId]/notifications.tsx`
- Buckets tab: `(app)/privacy/friends/[friendId]/buckets.tsx`

## Required states per surface

- header: default (with friend name + avatar + connection-age), blocked, archived
- their-system: empty (they share nothing yet), populated (read-only friend dashboard snapshot), with-sync-pending, error (key-unavailable)
- visibility: granular toggles per FriendVisibilitySettings — show me their fronters, show me their members, show me their custom fronts
- notifications: per-event-kind toggles (their front changes, their lifecycle events)
- buckets: assigned-buckets list with revoke-bucket affordance

## Mode notes

- Littles: their-system tab simplified to fronters only; notifications tab hidden
- High-contrast: per-tab indicator uses underline + label

## Primitives required

- ScreenScaffold, Tabs, Avatar, FrontingChip (ps-458i, for their fronters), MemberCard, BucketPill (ps-i6n1), Switch, KeyValueRow (ps-5lr6), Banner (key-unavailable), EmptyState (ps-ruwi), Button

## Data refs (informational)

- `apps/api/src/trpc/routers/friend.ts` get, dashboard, visibility, notifications, buckets

## Required output

- [ ] docs/design-system/preview/privacy-friend-detail.html with all 4 tabs + states
- [ ] Rationale on the their-system tab layout (mirror own home dashboard? or a more compact summary?)

## Out of scope

- RN code (M11), data wiring (M12), block / remove confirms (separate bean), dashboard export (separate bean)
