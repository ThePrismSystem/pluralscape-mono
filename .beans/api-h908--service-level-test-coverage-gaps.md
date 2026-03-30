---
# api-h908
title: Service-level test coverage gaps
status: todo
type: task
created_at: 2026-03-30T05:55:39Z
updated_at: 2026-03-30T05:55:39Z
parent: api-e7gt
---

Missing service-level tests identified during PR #329 review:

## Service tests needed

- [ ] structure-entity-type.service.ts — no dedicated service test
- [ ] structure-entity-association.service.ts — no dedicated service test
- [ ] structure-entity-link.service.ts — no service test (needs cycle detection tests)
- [ ] structure-entity-member-link.service.ts — no dedicated service test
- [ ] friend-connection.service.ts — accept/reject paths untested at service level
- [ ] device-transfer.service.ts — approve path untested at service level
- [ ] key-rotation.service.ts — retry path untested at service level

## Thin route tests

- [ ] apps/api/src/**tests**/routes/structure/entities.test.ts — archive/restore tests are single-assertion (status code only, no service call arg verification)
