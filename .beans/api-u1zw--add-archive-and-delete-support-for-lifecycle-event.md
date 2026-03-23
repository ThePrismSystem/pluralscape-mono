---
# api-u1zw
title: Add archive and delete support for lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-21T23:09:30Z
updated_at: 2026-03-22T11:48:19Z
parent: ps-mmpz
---

Lifecycle events are currently append-only in the CRDT strategy. They need archive and delete functionality to support data correction (e.g., mistakenly recorded events). Requires updating the CRDT strategy from append-only to append-lww, and adding archive/delete API endpoints.

## Acceptance Criteria

- [x] DB migration: add `version`, `archived`, `archived_at`, `updated_at` columns to `lifecycle_events`
- [x] Update `LifecycleEventService` with archive/restore/delete operations
- [x] Archive endpoint: `POST /systems/:systemId/lifecycle-events/:eventId/archive`
- [x] Restore endpoint: `POST /systems/:systemId/lifecycle-events/:eventId/restore`
- [x] Delete endpoint: `DELETE /systems/:systemId/lifecycle-events/:eventId`
- [x] Version column with monotonic increment on archive/restore (for CRDT sync)
- [x] Update CRDT strategy from `append-only` to `append-lww` in `crdt-strategies.ts`
- [x] Update OpenAPI spec: `paths/lifecycle-events.yaml` with archive/restore/delete operations
- [x] Route-level tests for new endpoints
- [ ] Update audit 011 if FK dependency graph changes

## Summary of Changes

- Added `version`, `archived`, `archivedAt`, `updatedAt` columns to `lifecycle_events` table in both PG and SQLite schemas
- Added `lifecycle-event.archived`, `lifecycle-event.restored`, `lifecycle-event.deleted` audit event types
- Changed CRDT strategy for `lifecycle-event` from `append-only` to `append-lww`
- Added `archiveLifecycleEvent`, `restoreLifecycleEvent`, `deleteLifecycleEvent` service functions using the generic entity-lifecycle helpers
- Created archive, restore, delete route files and wired them in the lifecycle events router
- Added OpenAPI definitions for the three new endpoints
- Updated route-level tests with coverage for archive (204), restore (200), delete (204), and error cases
- Updated existing DB integration tests and service tests to include the new columns
