---
# ps-hlq3
title: "PR #524 remediation: queue+imports review fixes"
status: completed
type: task
priority: high
created_at: 2026-04-20T13:39:00Z
updated_at: 2026-04-20T13:58:15Z
parent: ps-h2gl
---

Address the 5-agent review on PR #524 (chore/audit-m9-queue-imports). Two important issues + ~12 suggestions.

## Important

- [x] I1. IPv6 `[::1]` loopback never matches — strip brackets in both pk-api-source & import-sp api-source
- [x] I2. findStalledJobs fail-closed blast-radius comment + mixed-batch integration test

## Suggestions

- [x] S1. Tighten StoredJobDataSchema to drop 16 `as StoredJobData` casts (may need JOB_TYPE_VALUES / JOB_STATUS_VALUES tuples in packages/types)
- [x] S2. Drop dead `typeof token !== "string"` check in pk-api-source
- [x] S3. normaliseStatus edge-case tests (NaN/Infinity/negatives/zero/hex/partial/whitespace)
- [x] S4. Token whitespace: keep guard semantics, add test + docstring
- [x] S5. Replace `JSON.parse as Record` cast with narrowing guard in integration test
- [x] S6. Embed Zod issues in QueueCorruptionError message; update all call sites
- [x] S7. Preserve cause on `new URL` rethrow in both pk-api-source & import-sp api-source
- [x] S8. Inline single-use HTTP constants in error-classifier; keep range bounds
- [x] S9. Broaden isServerError → isRetryableHttpStatus (covers 429/404/5xx)
- [x] S10. Parameterise 7 corruption tests via it.each
- [x] S11. Narrow messageSuffix coercion via formatStatusSuffix helper

## Verification

- [x] `pnpm vitest run --project queue` passes — 278 tests
- [x] `pnpm vitest run --project queue-integration` passes (Valkey) — 128 tests
- [x] `pnpm vitest run --project import-pk` passes — 144 tests
- [x] `pnpm vitest run --project import-sp` passes — 384 tests
- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] `grep -rn "as StoredJobData" packages/queue/src/` returns 0 hits

Worktree: /home/theprismsystem/git/pluralscape-mono-queue-imports
Branch: chore/audit-m9-queue-imports

## Summary of Changes

**Important issues**

- I1: IPv6 loopback `[::1]` now accepted in both pk-api-source and import-sp api-source (`URL.hostname` returns `[::1]` — strip brackets before LOOPBACK_HOSTS lookup).
- I2: `findStalledJobs` fail-closed blast radius documented at the method header + mixed-batch test (3 enqueued, 1 corrupted, whole sweep aborts).

**Suggestions**

- S1: `StoredJobDataSchema` tightened. Added `JOB_TYPE_VALUES`/`JOB_STATUS_VALUES` const tuples to `@pluralscape/types`. Moved schema to `job-mapper.ts` so worker can validate too. Dropped all 16 `as StoredJobData` casts.
- S2: Dead `typeof token !== "string"` check removed.
- S3: Added `NaN`/`Infinity`/`-Infinity`/negative/`0`/hex/partial/empty/whitespace edge-case tests for `normaliseStatus`.
- S4: Token whitespace guard semantics preserved (reject whitespace-only, keep surrounding whitespace). New test + docstring.
- S5: `JSON.parse as Record` in integration test replaced with type-guard narrowing.
- S6: `QueueCorruptionError` now accepts optional `details` string; Zod issues embedded via `formatZodIssues` helper; all call sites updated.
- S7: `new URL` catch now passes `{ cause }` in both sources.
- S8: `DECIMAL_RADIX` inlined as `10`; kept HTTP-status constants (lint `no-magic-numbers` forbids bare literals).
- S9: `isServerError` → `isRetryableHttpStatus` (covers 429/404/5xx).
- S10: 7 corruption tests consolidated via `it.each` with typed case array.
- S11: `formatStatusSuffix` helper added; refuses non-primitive status shapes.

**Verification** — all test projects green, typecheck + lint clean.
