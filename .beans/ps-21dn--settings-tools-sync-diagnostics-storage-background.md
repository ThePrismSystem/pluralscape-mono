---
# ps-21dn
title: "Settings: Tools (sync diagnostics + storage + background jobs)"
status: todo
type: feature
created_at: 2026-05-17T06:46:58Z
updated_at: 2026-05-17T06:46:58Z
parent: ps-6a3x
---

## Goal

Design the three diagnostic / tool surfaces — sync diagnostics (live sync state + recent events), storage / quota (used vs quota with per-category breakdown), background jobs viewer (queue inspector with retry / cancel).

## Surfaces

- Sync: `(app)/settings/tools/sync.tsx`
- Storage: `(app)/settings/tools/storage.tsx`
- Jobs: `(app)/settings/tools/jobs.tsx`

## Required states per surface

- sync: live (with WebSocket / SSE indicator, last-sync timestamp, conflict count badge), with-paused warning, with-recent-events log, with-force-resync affordance, offline, error
- storage: usage bar (used / quota), per-category breakdown (members, photos, journal, snapshots, sync metadata), with-cleanup affordances per category, near-quota warning, over-quota error
- jobs: active jobs list (with progress), queued jobs list, recently-completed list, with-retry affordance for failed, with-cancel for active, empty (no jobs ever)

## Mode notes

- Littles: hidden
- High-contrast: bars / charts use border + label

## Primitives required

- ScreenScaffold, KeyValueRow (ps-5lr6), Banner, ProgressBar (ps-3m01), Card (per-job tile), Badge (status), Button, EmptyState (ps-ruwi), SyncIndicator (ps-gnkq), Accordion (ps-ecpl, recent events log)

## Data refs (informational)

- Local sync engine state (no router)
- `apps/api/src/trpc/routers/account.ts` storage usage
- Background queue inspection (local + server-side jobs)

## Required output

- [ ] docs/design-system/preview/settings-tools.html with all surfaces + states
- [ ] Rationale on the cleanup affordance UX (per-category vs free-form scan)

## Out of scope

- RN code (M11), data wiring (M12)
