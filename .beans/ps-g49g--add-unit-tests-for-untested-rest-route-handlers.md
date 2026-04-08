---
# ps-g49g
title: Add unit tests for untested REST route handlers
status: completed
type: task
priority: normal
created_at: 2026-04-07T23:04:45Z
updated_at: 2026-04-08T00:00:50Z
parent: ps-5h7y
---

17 route files in apps/api/src/routes/ have no unit tests, only E2E happy-path coverage. Add focused unit tests using existing mock helpers to push branch coverage past 91%.

## Progress

- 19 route files covered with unit tests
- 100 tests added across 7 commits
- Files: buckets/tags (3), fields/bucket-visibility (3), fronting-reports (4), buckets top-level (7), trpc/friend (1), trpc/friend-code (1)

## Summary of Changes

Added unit tests for 17 REST route files and 4 tRPC router files that previously had 0% function coverage or were only hit by E2E happy paths:

### REST routes (17 files)

- routes/buckets/tags: list, tag, untag
- routes/fields/bucket-visibility: list, set, remove
- routes/fronting-reports: create, delete, get, list
- routes/buckets: archive, create, delete, get, list, restore, update
- routes/analytics: co-fronting, fronting
- routes/systems: duplicate, purge
- routes/systems/snapshots: create, delete, get, list
- routes/webhook-configs: archive, restore
- routes/webhook-deliveries: delete, get

### tRPC routers (4 new + 4 improved)

- trpc/routers/friend (14 procedures)
- trpc/routers/friend-code (4 procedures)
- trpc/routers/webhook-config (9 procedures)
- trpc/routers/webhook-delivery (3 procedures)
- Added missing procedure tests to board-message (pin, unpin)
- Added delete test to snapshot router
- Added entity-pubsub mocks to board-message, poll, acknowledgement

All tests mock services at the module boundary and test success path, service argument forwarding, ID validation, body schema validation, auth, and rate limiting.
