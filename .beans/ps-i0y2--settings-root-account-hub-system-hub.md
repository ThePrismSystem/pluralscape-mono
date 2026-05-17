---
# ps-i0y2
title: "Settings: Root + account hub + system hub"
status: todo
type: feature
created_at: 2026-05-17T06:45:42Z
updated_at: 2026-05-17T06:45:42Z
parent: ps-6a3x
---

## Goal

Design the top-level Settings root screen and its two main hubs (account-level settings, system-level settings).

## Surfaces

- Settings root: `(app)/settings/index.tsx`
- Account hub: `(app)/settings/account/index.tsx`
- System hub: `(app)/settings/system/index.tsx`

## Required states per surface

- root: default (with both hubs visible + Tools + Help entries), with-recovery-key-reminder badge, with-storage-warning badge, error
- account hub: default (email, password, recovery, devices, audit log entries), with-multi-system-switcher visible
- system hub: default (nomenclature, privacy defaults, theme, accessibility, language, notifications)

## Mode notes

- Littles: Settings simplified — only Help / About + a parent-controlled "Adult settings" gated section
- High-contrast: hub-section card uses border + label

## Primitives required

- ScreenScaffold, ListItem (settings rows), Section (grouped), Badge (reminder / warning), Card (hub-section tile), Icon

## Data refs (informational)

- `apps/api/src/trpc/routers/account.ts` settings
- `apps/api/src/trpc/routers/system.ts` settings

## Required output

- [ ] docs/design-system/preview/settings-root-hubs.html with all surfaces + states
- [ ] Rationale on the account-vs-system split (which settings belong where)

## Out of scope

- RN code (M11), data wiring (M12), individual settings sub-screens (separate beans)
