---
# ps-axyv
title: SP seed script — first live run against real SP API
status: todo
type: task
priority: normal
created_at: 2026-04-11T19:36:04Z
updated_at: 2026-04-11T19:36:04Z
parent: ps-nrg4
blocked_by:
  - ps-2mrz
---

Operator-driven task deferred from ps-2mrz. Required before landing the new seed script in a release that downstream E2E fixtures depend on.

Prereqs:

- Two real email addresses reachable by operator (one for minimal mode, one for adversarial)
- SP_TEST_PASSWORD set in env or .env.sp-test (or accept the fallback password)
- Run from monorepo root: pnpm seed:sp-test --minimal-email=<m> --adversarial-email=<a>

Expected flow per mode:

1. Bootstrap account (register, fall through to login on 409)
2. GET/PATCH /v1/private/<uid> (ToS accept)
3. POST /v1/token/<dummy> → raw API key
4. Persist SP*TEST*<MODE>\_API_KEY to .env.sp-test
5. planSeed probes existing entities (first run has no manifest → all creates)
6. Create all 13 entity types in order, writing manifest after each
7. Trigger export → operator downloads JSON from email → save to scripts/.sp-test-<mode>-export.json

Validate:

- Both modes complete without 5xx
- .env.sp-test persists both API keys
- scripts/.sp-test-minimal-manifest.json and scripts/.sp-test-adversarial-manifest.json exist with ref entries
- Resolve any empirical unknowns (ToS PATCH body shape, per-entity required fields, probe path edge cases for rarely-used entity types)
- Re-run to verify idempotency: second run should reuse all entities (planSeed returns empty create list)
- After operator saves exports, run pnpm test:e2e with SP*TEST*\*\_API_KEY env vars set — E2E ApiSource and FileSource suites should run (currently skipped) and pass
