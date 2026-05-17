---
# ps-h97n
title: "Privacy: Friends list"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:40:59Z
updated_at: 2026-05-17T07:42:05Z
parent: ps-9xue
blocked_by:
  - ps-5920
---

## Goal

Design the friend list — system-side roster of all friend connections, with per-friend bucket count and last-sync time.

## Surfaces

- Friend list: `(app)/privacy/friends/index.tsx`

## Required states per surface

- empty (no friends), populated with mixed statuses (active, blocked, archived), filtered (by bucket, by sync state), with-pending-incoming-requests banner, error

## Mode notes

- Littles: hidden if account has no parent / caregiver opt-in
- High-contrast: per-friend status badge uses icon + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), FAB (add friend → friend code redeem), Card (friend row), Avatar, Badge (status), BucketPill (ps-i6n1, stacked), SyncIndicator (ps-gnkq), EmptyState (ps-ruwi), Banner (pending requests)

## Data refs (informational)

- `apps/api/src/trpc/routers/friend.ts` list

## Required output

- [ ] docs/design-system/preview/privacy-friends-list.html with all states
- [ ] Rationale on row content (avatar + name vs avatar + name + bucket-summary)

## Out of scope

- RN code (M11), data wiring (M12), friend detail tabs (separate bean), friend codes (separate bean)
