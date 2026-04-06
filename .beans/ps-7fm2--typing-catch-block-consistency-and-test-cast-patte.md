---
# ps-7fm2
title: "Typing: catch block consistency and test cast patterns"
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T09:45:50Z
parent: ps-y621
---

Minor typing improvements:

1. 38 catch blocks across sync, db, crypto, mobile lack explicit : unknown annotation. Functionally correct (tsconfig enables useUnknownInCatchVariables) but inconsistent with files that do annotate.

2. Test files use as Error / as RowTransformError casts in catch blocks instead of instanceof narrowing:
   - apps/mobile/src/data/**tests**/row-transforms.test.ts:110,122
   - packages/sync/src/**tests**/errors.test.ts:46
   - packages/crypto/src/**tests**/blob-pipeline/content-validation.test.ts:152

3. packages/sync/src/engine/sync-engine.ts:210 — generic cast on type-erased Map could use registry/brand check.

4. packages/types/src/jobs.ts:63-68 — 9 job payload entries use Record<string, unknown> as placeholder. Narrow as handlers are built.

Audit ref: Pass 4 MEDIUM + LOW

## Summary of Changes

1. Added : unknown annotation to 34 catch blocks across crypto, db, sync, and mobile packages.
2. Replaced as Error/as RowTransformError casts with instanceof narrowing in 3 test files.
3. sync-engine.ts generic cast left as-is — JSDoc already documents the assertion.
4. jobs.ts placeholder payloads deferred until handlers are built.
