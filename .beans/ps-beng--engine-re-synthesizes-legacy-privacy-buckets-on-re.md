---
# ps-beng
title: Engine re-synthesizes legacy privacy buckets on resume even when source has real ones
status: completed
type: bug
priority: normal
created_at: 2026-04-17T09:13:02Z
updated_at: 2026-04-19T18:53:11Z
parent: ps-0enb
---

## Problem

When the SP import engine resumes from a checkpoint whose `completedCollections` does not yet include `member`, it unconditionally invokes `persistSynthesizedBuckets` upon entering the `members` collection — even if the previous (pre-abort) run already imported real privacy buckets from the source.

Root cause: `privacyBucketsMapped` is an ephemeral per-run counter, not persisted in the checkpoint. On resume it is reset to `0` (or `1` only if `member` is completed), so the engine cannot tell whether the prior run already mapped real privacyBuckets documents.

Effect: Resumed runs end up with 3 extra `privacy-bucket:synthetic:{private,public,trusted}` entries that a baseline (uninterrupted) run does not produce. These synthetic buckets are orphaned (no member references them when real buckets exist) and bloat the privacy-bucket table.

## Repro

`packages/import-sp/src/__tests__/e2e/sp-import.e2e.test.ts` — the "checkpoint resume produces the same final entity set as a full run" test currently accommodates this by asserting the resumed set is a superset of the baseline plus at most the 3 synthetic buckets. Remove that allowance once fixed.

## Proposed fix

Persist the per-run privacy-bucket real-count outcome in the checkpoint (e.g., a boolean `realPrivacyBucketsMapped: boolean` inside `checkpoint` subtree, schemaVersion bump). On resume, read it instead of inferring from `completedCollections`. Skip legacy synthesis whenever the source had real buckets, regardless of where the resume point lands.

## Scope

Engine-level change; requires checkpoint schemaVersion bump and migration of the existing schema-v1 state.

## Acceptance

- Baseline and resumed entity sets are byte-identical given the same minimal fixture.
- Existing `legacy-bucket-synthesis.engine.test.ts` tests continue to pass.
- Test at `e2e/sp-import.e2e.test.ts` can assert `resumedKeys === baselineKeys` without the synthetic-bucket allowance.

## Summary of Changes

- Bumped `ImportCheckpointState` schemaVersion from `1` to `2` (pre-release; no v1 data exists).
- Added `realPrivacyBucketsMapped: boolean` to the checkpoint subtree.
- New helper `markRealPrivacyBucketsMapped(state)` in `@pluralscape/import-core`, re-exported via `packages/import-sp/src/engine/checkpoint.ts`.
- `packages/import-sp/src/engine/import-engine.ts` now reads the checkpointed flag instead of inferring from `completedCollections.includes("member")`, and persists the flag whenever a real bucket is upserted.
- Tightened the SP import E2E assertion — resumed and baseline entity sets are now byte-identical; the "superset + 3 synthetic buckets" allowance is removed.
- Updated all tests that hard-coded `schemaVersion: 1` or constructed checkpoint fixtures to match v2 (branch-coverage, resume-from-checkpoint, db integration, validation, api integration, mobile runner, types test).
- Regenerated zod schema in `packages/validation/src/import-job.ts` and OpenAPI definitions (`docs/openapi.yaml`, `docs/openapi/schemas/import-export.yaml`, `packages/api-client/src/generated/api-types.ts`) to include the new required field.
