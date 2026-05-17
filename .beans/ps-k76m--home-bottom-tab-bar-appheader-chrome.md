---
# ps-k76m
title: "Home: Bottom tab bar + AppHeader chrome"
status: todo
type: feature
created_at: 2026-05-17T06:35:03Z
updated_at: 2026-05-17T06:35:03Z
parent: ps-divy
---

## Goal

Design the persistent chrome surfaces — bottom tab bar (5 tabs) and the AppHeader bar (system name, active fronter chip, sync indicator, action slot).

## Surfaces

- Bottom tab bar: persistent below (app) routes
- AppHeader: persistent above (app) routes

## Required states per surface

- tabs: idle, active-tab (filled icon + 4px Lavender dot per BRANDING), with unread-badge on Notifications, with Littles-mode reduced tab set
- header: default, with-fronter-chip-pressed (opens FrontingChip detail popover), syncing indicator visible, with-action-button

## Mode notes

- Littles: fewer tabs (Members + Front + Communicate only); header simplified to system name
- Web ≥1024px: tab bar replaced by Drawer (ps-217e); header stays
- High-contrast: active tab uses underline + filled icon (not color-only)

## Primitives required

- BottomTabBar (existing), AppHeader (existing), FrontingChip (ps-458i), SyncIndicator (ps-gnkq), SystemSwitcher (ps-a5pt) entry point
- Badge (unread count)

## Data refs (informational)

- `apps/api/src/trpc/routers/fronting-session.ts` (activeFronters for chip)
- Sync subscription state (local store)
- `apps/api/src/trpc/routers/system.ts` (current system label)

## Required output

- [ ] docs/design-system/preview/home-chrome.html with both chrome surfaces in their states
- [ ] Rationale for the 5-tab pick (Members / Front / Communicate / Privacy / More)

## Out of scope

- RN code (M11), data wiring (M12), the actual screens those tabs lead to (separate beans)
