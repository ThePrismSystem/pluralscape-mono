---
# api-bae0
title: Add generic REST routes for system structure entities
status: completed
type: feature
priority: critical
created_at: 2026-03-29T21:30:54Z
updated_at: 2026-03-30T00:15:25Z
parent: api-e7gt
---

The M4 refactor (commit 52a6e9e6) removed 9 rigid structure routes (subsystems/side-systems/layers) and replaced the DB model with a generic 5-table entity model, but generic REST routes were never created. CRDT sync handles eventual consistency, but REST endpoints are needed for server-side operations.

Add REST CRUD routes for all 5 table types:

- Entity types: create/get/update/delete/list
- Structure entities: create/get/update/archive/restore/delete/list (with type and archive filters)
- Entity links: create/delete/list (parent-child hierarchy)
- Entity associations: create/delete/list (directed cross-type)
- Member links: create/delete/list (member-to-entity assignments)
- Recursive hierarchy endpoint with depth cap
- Enriched member-centric membership query

Validation query schemas already exist in @pluralscape/validation. DB schema in packages/db/src/schema/pg/structure.ts.

Audit ref: docs/audits/feature-completeness-audit-2026-03-29.md — Domain 6, gaps 1-7

## Summary of Changes

- Created `structure-entity.service.ts` with full CRUD for 5 structure entity tables
- Created 24 route handler files across 5 sub-directories under `routes/structure/`
- Mounted at `/:systemId/structure` in systems routes
- 35 unit tests covering all route handlers
- Entity types and entities use archiveEntity/restoreEntity from entity-lifecycle.ts
- Junction tables (links, associations, member-links) use simple create/delete/list
- Hierarchy endpoint uses recursive CTE capped at MAX_ANCESTOR_DEPTH
- Delete guards enforce referential integrity
