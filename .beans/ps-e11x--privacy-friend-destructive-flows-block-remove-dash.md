---
# ps-e11x
title: "Privacy: Friend destructive flows (block / remove + dashboard export)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:41:17Z
updated_at: 2026-05-17T07:42:04Z
parent: ps-9xue
blocked_by:
  - ps-5920
---

## Goal

Design the friend block / remove confirm dialogs and the dashboard export flow (one-shot snapshot of what a friend currently sees from this system).

## Surfaces

- Block confirm: invoked from friend detail
- Remove confirm: invoked from friend detail
- Dashboard export: `(app)/privacy/friends/[friendId]/export.tsx`

## Required states per surface

- block: warning (consequences), typed-confirm, submitting, success
- remove: warning, typed-confirm "REMOVE [friend name]", submitting, success-redirect-to-list
- dashboard export: idle (manifest of what's included), generating with progress, ready (download + share), error

## Mode notes

- Littles: all hidden
- High-contrast: destructive states pair icon + label

## Primitives required

- DestructiveConfirmDialog (ps-bydy), Button, TextField (typed-confirm), ProgressBar (ps-3m01), KeyValueRow (ps-5lr6, manifest), Banner

## Data refs (informational)

- `apps/api/src/trpc/routers/friend.ts` block, remove, exportDashboard

## Required output

- [ ] docs/design-system/preview/privacy-friend-destructive.html with all flows + states
- [ ] Copy decisions per GOVERNANCE.md §6 / §7

## Out of scope

- RN code (M11), data wiring (M12), the friend detail tabs (separate bean)
