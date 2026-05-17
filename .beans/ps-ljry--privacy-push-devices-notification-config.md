---
# ps-ljry
title: "Privacy: Push devices + notification config"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:41:42Z
updated_at: 2026-05-17T07:42:06Z
parent: ps-9xue
blocked_by:
  - ps-5920
---

## Goal

Design the push-device list (registered devices with revoke affordance) and the per-system notification config (kind toggles + per-friend overrides).

## Surfaces

- Devices: `(app)/privacy/devices/index.tsx`
- Notification config: `(app)/settings/notifications/index.tsx`

## Required states per surface

- devices: empty, populated (with current-device indicator, with-disabled-device row), with-permission-not-granted banner, error
- notification config: per-event-kind toggles (friend front change, mandatory ack received, lifecycle event, recovery-key reminder, webhook failure), per-friend overrides (Accordion of friend × event-kind matrix), with-do-not-disturb scheduling, save / cancel

## Mode notes

- Littles: only "Caregiver alerts" toggle visible; everything else hidden
- High-contrast: per-device status uses icon + label

## Primitives required

- ScreenScaffold, InfiniteList (ps-hijf), Card (device row), KeyValueRow (ps-5lr6), Switch, Banner (permission notice), Button, Accordion (ps-ecpl, per-friend overrides), MultiMemberPicker (ps-djqo, scoped do-not-disturb), DestructiveConfirmDialog (ps-bydy, revoke device)

## Data refs (informational)

- `apps/api/src/trpc/routers/device-token.ts` list, register, revoke
- `apps/api/src/trpc/routers/notification-config.ts` get, update

## Required output

- [ ] docs/design-system/preview/privacy-devices-notifications.html with all surfaces + states
- [ ] Rationale on the per-friend overrides UX (matrix vs nested-toggle)

## Out of scope

- RN code (M11), data wiring (M12), the OS permission prompt surface (handled by OS)
