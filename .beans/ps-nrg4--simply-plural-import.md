---
# ps-nrg4
title: Simply Plural import
status: in-progress
type: epic
priority: normal
created_at: 2026-03-31T23:13:07Z
updated_at: 2026-04-08T14:10:37Z
parent: ps-h2gl
---

Import flow UI, data mapping logic, progress/error handling, conflict resolution

## Implementation progress

### Plan 1 Phase A complete (types changes)

- bca407a8: feat(types): add recoverable field to ImportError (Task 1)
- 8a8abd58: feat(types): add ImportEntityRefId branded ID (Task 3)
- 63517d43: feat(types): add ImportCheckpointState and ImportEntityRef (Tasks 2+4)
- fe5918b3: feat(types): allow null Poll.createdByMemberId for imported polls (Task 5)

### Plan 1 complete (Tasks 1-27)

Foundation layer for SP import is in place: types, schemas, migrations, services, tRPC routers, REST routes, and full /verify pass.

- Task 14: db294ea1, 441bd9dd, fac66a74, 3a... (db schema + RLS + integration tests)
- Tasks 16-17: 2fa9e940, d6955f7e (zod validation schemas)
- Tasks 18-19: e6cdf72d, 6da0e9cf (services with PGlite integration tests)
- Tasks 20-21: f89de9fa, c4de47c1 (tRPC routers)
- Tasks 22-23: d11cc2bb (REST routes)
- Task 25: f704dd77 (tRPC parity mappings)
- Task 27: full /verify pass — 13948 unit + 2619 integration + 461 e2e tests passing

Next: write Plans 2 (import-sp package) and 3 (mobile glue + E2E).
