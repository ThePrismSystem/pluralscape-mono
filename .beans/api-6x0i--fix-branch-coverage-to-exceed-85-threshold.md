---
# api-6x0i
title: Fix branch coverage to exceed 85% threshold
status: completed
type: bug
priority: normal
created_at: 2026-03-30T02:39:28Z
updated_at: 2026-04-16T07:29:50Z
parent: ps-n8uk
---

CI fails: branch coverage is 83.17%, threshold is 85%. Need service-level unit tests for new 0% coverage services (structure-entity, api-key, friend-dashboard-sync, account-pin) and branch gap tests for partially-covered services (device-token, poll-vote, lifecycle-event, field-value).

## Summary of Changes\n\nAdded service-level unit tests for 8 services, raising branch coverage from 83.17% to 88.13% (threshold: 85%).\n\nNew test files:\n- structure-entity.service.test.ts\n- api-key.service.test.ts\n- friend-dashboard-sync.service.test.ts\n- account-pin.service.test.ts\n- poll-vote.service.update-delete-results.test.ts\n- lifecycle-event.service.update-cursor.test.ts\n- hierarchy-service-factory.test.ts\n\nExtended test files:\n- device-token.service.test.ts\n- field-value.service.test.ts\n\nAlso added groupBy to MockChain in mock-db.ts.
