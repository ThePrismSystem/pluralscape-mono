---
# api-cimz
title: Relocate structure-entity-link/-member-link/-association into services/structure/
status: completed
type: task
priority: normal
created_at: 2026-04-22T02:42:52Z
updated_at: 2026-04-22T07:29:21Z
parent: api-6l1q
---

Deferred from api-35hk and api-r37m during the api-6l1q refactor.

## Problem

Routes are nested under `routes/structure/entity-links/`, `entity-member-links/`, `entity-associations/`, but the corresponding service files remain flat at the top of services/:

- `services/structure-entity-link.service.ts` (~100-200 LOC, below refactor threshold)
- `services/structure-entity-member-link.service.ts`
- `services/structure-entity-association.service.ts`

These were kept flat during PR 2 to tighten the diff. Per the api-6l1q nesting rule (service nests iff routes do AND both in scope), these should move under `services/structure/` to match the routes tree. The legacy barrel `services/structure-entity.service.ts` still re-exports them; this follow-up would relocate them and update the barrel's re-export paths (or remove the barrel).

## Scope

- Move the 3 service files into services/structure/ as peer single-file modules (link.ts / member-link.ts / association.ts) or as verb-split dirs if LOC warrants
- Update the legacy `structure-entity.service.ts` barrel to re-export from new paths (or delete the barrel if all callers updated)
- Update any callers that still import from the flat paths

## Acceptance

- No imports reference `services/structure-entity-{link,member-link,association}.service.js`
- Routes under `routes/structure/` continue to work
- Verify suite passes

## Summary of Changes

Moved structure-entity-link/-member-link/-association service files into services/structure/{link,member-link,association}.ts as flat peer modules. Deleted the legacy services/structure-entity.service.ts barrel. Rewrote imports in 25 route files + tRPC structure router + 4 route/test call sites to import directly from the per-file verbs (Option E). Renamed the 3 associated service test files to match the new locations. Preserved entity-crud unit coverage by extracting the entity-crud describe blocks from the deleted barrel test into a new **tests**/services/structure/entity-crud.test.ts; entity-type/link/member-link/association blocks were duplicative of existing per-service test files.
