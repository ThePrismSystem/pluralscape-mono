---
# api-u1zw
title: Add archive and delete support for lifecycle events
status: todo
type: task
priority: normal
created_at: 2026-03-21T23:09:30Z
updated_at: 2026-03-22T11:48:19Z
parent: ps-mmpz
---

Lifecycle events are currently append-only in the CRDT strategy. They need archive and delete functionality to support data correction (e.g., mistakenly recorded events). Requires updating the CRDT strategy from append-only to append-lww, and adding archive/delete API endpoints.

## Acceptance Criteria

- [ ] DB migration: add `version`, `archived`, `archived_at`, `updated_at` columns to `lifecycle_events`
- [ ] Update `LifecycleEventService` with archive/restore/delete operations
- [ ] Archive endpoint: `POST /systems/:systemId/lifecycle-events/:eventId/archive`
- [ ] Restore endpoint: `POST /systems/:systemId/lifecycle-events/:eventId/restore`
- [ ] Delete endpoint: `DELETE /systems/:systemId/lifecycle-events/:eventId`
- [ ] OCC version check on archive/restore (new version column)
- [ ] Update CRDT strategy from `append-only` to `append-lww` in `crdt-strategies.ts`
- [ ] Update OpenAPI spec: `paths/lifecycle-events.yaml` with archive/restore/delete operations
- [ ] Route-level tests for new endpoints
- [ ] Update audit 011 if FK dependency graph changes
