---
# ps-zl09
title: SP import real E2E tests + PersisterApi bridge + branch coverage
status: completed
type: task
priority: normal
created_at: 2026-04-12T02:19:58Z
updated_at: 2026-04-12T04:21:35Z
parent: ps-nrg4
---

Build production PersisterApi tRPC bridge, write real E2E tests that persist through the Pluralscape API, and improve branch coverage above 89%. Plan: docs/superpowers/plans/2026-04-11-sp-import-e2e-tests.md

## Summary of Changes

**Production PersisterApi tRPC bridge (2 commits)**

- `trpc-persister-api.ts` — maps vanilla tRPC client to PersisterApi interface for all 16 entity groups
- Replaced throwing placeholder in `import.hooks.ts` with real bridge

**PersisterApi type alignment (1 commit)**

- Expanded PersisterApi proc types to carry plaintext metadata fields the server requires (fieldType, startTime, sessionId, sortOrder, poll config, etc.)
- Updated 8 per-entity persisters to extract metadata before encrypting
- Updated bridge TRPCClientSubset and methods to match
- Updated all persister tests and mock helpers

**Real E2E tests (1 commit)**

- Global setup boots Postgres, MinIO, API server
- E2E helpers: account registration, tRPC client, crypto, persister wiring
- 23 E2E tests: file source (minimal + adversarial), API source (minimal + adversarial), checkpoint resume
- All tests persist through the real Pluralscape API and verify via tRPC queries

**Branch coverage (1 commit)**

- 6 files improved: import-engine, api-source, file-source, mapper-dispatch, dependency-order, entity-type-map
- Branch coverage: 84.89% → 89.18% (threshold: 89%)

**Verification:** typecheck clean, lint clean, 11587 unit + 2666 integration + 473 E2E tests passing.
