---
# ps-2mrz
title: Rewrite scripts/seed-sp-test-data.ts
status: in-progress
type: task
priority: normal
created_at: 2026-04-11T18:02:39Z
updated_at: 2026-04-11T18:21:55Z
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
- [ ] Scaffold scripts/sp-seed/ module + vitest project wiring
- [ ] TDD: extractObjectIdFromText, uidFromJwt, resolveRefs (pure helpers)
- [ ] TDD: SpClient (bootstrap, request, requestRaw, typed errors)
- [ ] TDD: env.ts read/write + gitignore safety assertion
- [ ] Define fixture types and port minimal + adversarial fixtures with refs
- [ ] TDD: fixture integrity tests (no forward refs, no duplicate refs)
- [ ] TDD: manifest.ts atomic write + planSeed
- [ ] Wire executePlan + seedMode driver
- [ ] Update E2E consumers: manifest.types.ts, helpers.ts, sp-import.e2e.test.ts
- [ ] Update .gitignore (.env.sp-test, widen scripts/.sp-test-\*.json)
- [ ] Update package.json seed:sp-test script path
- [ ] Delete old scripts/seed-sp-test-data.ts
- [ ] First live run — resolve empirical unknowns (ToS body, per-entity required fields, probe paths for 4 entity types)
- [ ] pnpm verify + commit
