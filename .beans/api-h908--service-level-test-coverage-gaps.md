---
# api-h908
title: Service-level test coverage gaps
status: completed
type: task
priority: normal
created_at: 2026-03-30T05:55:39Z
updated_at: 2026-03-31T07:32:26Z
parent: api-e7gt
---

Missing service-level tests identified during PR #329 review:

## Service tests needed

- [x] structure-entity-type.service.ts — no dedicated service test
- [x] structure-entity-association.service.ts — no dedicated service test
- [x] structure-entity-link.service.ts — no service test (needs cycle detection tests)
- [x] structure-entity-member-link.service.ts — no dedicated service test
- [x] friend-connection.service.ts — accept/reject paths untested at service level
- [x] device-transfer.service.ts — approve path untested at service level
- [x] key-rotation.service.ts — retry path untested at service level

## Thin route tests

- [x] apps/api/src/**tests**/routes/structure/entities.test.ts — archive/restore tests now include service call arg verification

## Summary of Changes\n\nAdded service-level unit tests for 7 services:\n- structure-entity-type.service.ts (create, list, get, update, archive, restore, delete + HAS_DEPENDENTS)\n- structure-entity-association.service.ts (create, list, delete, getEntityHierarchy)\n- structure-entity-link.service.ts (create with cycle/depth checks, update, list, delete)\n- structure-entity-member-link.service.ts (create, list, delete)\n- friend-connection.service.ts (accept/reject paths)\n- device-transfer.service.ts (approve path)\n- key-rotation.service.ts (retry path)\n\nStrengthened structure entity route tests with service call argument verification for archive/restore.
