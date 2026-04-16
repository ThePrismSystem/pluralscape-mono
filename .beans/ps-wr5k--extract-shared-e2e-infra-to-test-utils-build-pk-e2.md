---
# ps-wr5k
title: Extract shared E2E infra to test-utils & build PK E2E with real API server
status: completed
type: task
priority: normal
created_at: 2026-04-12T21:18:17Z
updated_at: 2026-04-16T07:29:56Z
parent: ps-dvxb
---

Phase 1: Extract Docker, API server, account, tRPC client, crypto, persister-base, ref-helpers, and setup into @pluralscape/test-utils/e2e. Phase 2: Refactor import-sp E2E to use shared infra. Phase 3: Build import-pk E2E with real server persistence.

## Summary of Changes

### Phase 1: Shared E2E infrastructure in test-utils

- Created `tooling/test-utils/src/e2e/` with 7 shared modules:
  - `docker.ts`: Container lifecycle (Postgres, MinIO)
  - `api-server.ts`: API server spawn, health poll, teardown
  - `account.ts`: Test account registration, system ID discovery
  - `e2e-persister-base.ts`: Generic persister with DI for crypto/tRPC (avoids turbo cycle)
  - `ref-helpers.ts`: Import entity ref lookup with structural tRPC typing
  - `setup.ts`: `createE2EGlobalSetup()` factory for vitest globalSetup
  - `index.ts`: Barrel re-exports
- Added `./e2e` export to test-utils package.json

### Phase 2: Refactored import-sp E2E

- `global-setup.ts`: Now delegates to `createE2EGlobalSetup()`
- `global-teardown.ts`: Now delegates to shared `killServer()`
- `e2e-helpers.ts`: Keeps SP-specific handleCreate/handleUpdate dispatch, uses shared persister base with injected crypto/tRPC
- `entity-assertions.ts`: Uses shared `lookupRefs`/`requireRef` from test-utils

### Phase 3: Built import-pk E2E with real API server

- Created `global-setup.ts`, `global-teardown.ts` (delegates to shared infra)
- Created `entity-assertions.ts` with PK-specific assertions (members, groups, sessions, buckets)
- Rewrote `e2e-helpers.ts` with PK-specific handleCreate dispatch for 4 entity types
- Rewrote `pk-import.e2e.test.ts` with both in-memory and server-backed test suites
- Created `vitest.pk-e2e.config.ts` standalone config
- Added `test:e2e:pk-import` script to root package.json
- Removed `import-pk-e2e` from main vitest.config.ts
- Updated import-pk devDeps

### Key design decision

Crypto and tRPC dependencies are injected via generics/structural types to avoid a turbo circular dependency (test-utils <-> crypto/api).
