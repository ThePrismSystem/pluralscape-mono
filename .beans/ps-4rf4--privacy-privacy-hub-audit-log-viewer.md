---
# ps-4rf4
title: "Privacy: Privacy hub + audit log viewer"
status: todo
type: feature
created_at: 2026-05-17T06:40:22Z
updated_at: 2026-05-17T06:40:22Z
parent: ps-9xue
---

## Goal

Design the Privacy hub (landing for buckets / friends / devices / notifications) and the security audit log viewer (login timestamps, IP addresses, failed attempts, data exports).

## Surfaces

- Privacy hub: `(app)/privacy/index.tsx`
- Audit log: `(app)/settings/security/audit-log.tsx`

## Required states per surface

- hub: default (with-pending-rotations banner if any), empty (first-time, no friends yet), with-bucket-count summary, error
- audit log: empty, populated with various event kinds, filtered (by-kind, by-date-range), with-IP-tracking-disabled notice, error

## Mode notes

- Littles: audit log hidden; hub simplified to buckets only
- High-contrast: per-event-kind chip uses icon + label

## Primitives required

- ScreenScaffold, Card (hub sub-area tile), Badge, Banner (pending rotations / data-loss warnings), InfiniteList (ps-hijf), KeyValueRow (ps-5lr6, audit-log rows), Chip (filter), EmptyState (ps-ruwi), EncryptionTierBadge (ps-gfhz)

## Data refs (informational)

- `apps/api/src/trpc/routers/bucket.ts` summary
- `apps/api/src/trpc/routers/friend.ts` count
- `apps/api/src/trpc/routers/account.ts` audit-log subroute

## Required output

- [ ] docs/design-system/preview/privacy-hub-audit.html with all states
- [ ] Rationale on the audit-log row layout (one-line vs two-line per event)

## Out of scope

- RN code (M11), data wiring (M12), individual bucket/friend/device sub-screens (separate beans)
