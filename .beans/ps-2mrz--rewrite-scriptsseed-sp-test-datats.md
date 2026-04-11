---
# ps-2mrz
title: Rewrite scripts/seed-sp-test-data.ts
status: completed
type: task
priority: normal
created_at: 2026-04-11T18:02:39Z
updated_at: 2026-04-11T19:35:47Z
parent: ps-nrg4
---

Full rewrite of scripts/seed-sp-test-data.ts — the current script is completely broken (auth flow, id extraction, no API key creation, no idempotency). Design approved 2026-04-11.

Spec: docs/superpowers/specs/2026-04-11-sp-seed-script-rewrite-design.md (local only)

Key outcomes:

- New scripts/sp-seed/ module layout with SpClient, fixtures, manifest, env, driver, tests
- Ref-keyed idempotent re-runs (probe SP, reuse live entities, create missing)
- Crash-resilient atomic manifest writes after each entity creation
- Combined .env.sp-test file (persists API key per mode, replaces broken JWT persistence)
- Export trigger with 429 handling; operator manually downloads JSON from email
- Manifest format gets a new 'ref' field — requires updating packages/import-sp/src/**tests**/e2e consumers

Pending: implementation plan (next step via writing-plans skill).

## Todo

- [x] Write implementation plan via superpowers:writing-plans
- [x] Scaffold scripts/sp-seed/ module + vitest project wiring
- [x] TDD: extractObjectIdFromText, uidFromJwt, resolveRefs (pure helpers)
- [x] TDD: SpClient (bootstrap, request, requestRaw, typed errors)
- [x] TDD: env.ts read/write + gitignore safety assertion
- [x] Define fixture types and port minimal + adversarial fixtures with refs
- [x] TDD: fixture integrity tests (no forward refs, no duplicate refs)
- [x] TDD: manifest.ts atomic write + planSeed
- [x] Wire executePlan + seedMode driver
- [x] Update E2E consumers: manifest.types.ts, helpers.ts, sp-import.e2e.test.ts
- [x] Update .gitignore (.env.sp-test, widen scripts/.sp-test-\*.json)
- [x] Update package.json seed:sp-test script path
- [x] Delete old scripts/seed-sp-test-data.ts
- [ ] First live run — resolve empirical unknowns (ToS body, per-entity required fields, probe paths for 4 entity types)
- [x] pnpm verify + commit

## Summary of Changes

Full rewrite of the SP test-data seed script. The old 1069-line `scripts/seed-sp-test-data.ts` was deleted and replaced with a modular `scripts/sp-seed/` package.

**New module layout (`scripts/sp-seed/`):**

- `constants.ts` — SP API defaults, delays, paths, entity POST/probe path tables
- `client.ts` — `SpClient` with inflight-mutex serialization, 5xx single-retry, raw `Authorization` header (no `Bearer`), typed error classes, `bootstrap()` static that reuses stored API keys via `/v1/me` probe and falls through to register/login + ToS flow + `/v1/token/:dummy` on 401
- `env.ts` — read/write `.env.sp-test` with gitignore safety assertion, section headers, atomic writes
- `manifest.ts` — ref-keyed `ManifestEntry` format, atomic `writeManifestAtomic`, `planSeed` (live probe → reuse/create classification)
- `seed.ts` — `resolveRefs`, `executePlan` (persists manifest after each entity), `seedMode` orchestrator, `triggerExportWith429Handling`
- `index.ts` — CLI entrypoint with CLI/env email resolution
- `fixtures/` — typed minimal + adversarial fixture sets (13 entity types, Unicode/boundary coverage in adversarial)
- `__tests__/` — 57 unit tests (client, env, manifest, seed, fixtures)

**Consumer updates:**

- `packages/import-sp/src/__tests__/e2e/manifest.types.ts` — added `readonly ref: string` to `ManifestEntry`
- `packages/import-sp/src/__tests__/e2e/helpers.ts` — legacy manifest detection, `findByRef` helper, env key rename (`_TOKEN` → `_API_KEY`), export path migration (`scripts/fixtures/` → `scripts/.sp-test-`)
- `packages/import-sp/src/__tests__/e2e/sp-import.e2e.test.ts` — `findByRef` spot check with mode-aware strict assertion for minimal fixture

**Other:**

- `.gitignore` — `.env.sp-test`, widened `scripts/.sp-test-*.json`
- `package.json` — `seed:sp-test` repointed to `tsx scripts/sp-seed/index.ts`
- `vitest.config.ts` — widened scripts project include pattern

**Verification:**

- format: ✓ lint: ✓ typecheck: ✓
- unit: 11460 passed / 23 skipped
- integration: 2655 passed
- e2e: 473 passed

**Deferred:** Task 24 (first live run against real SP API) is operator-driven — requires real email addresses, running `pnpm seed:sp-test`, and manually downloading the export JSON from email. Follow-up bean should track this once operator has the creds ready.
