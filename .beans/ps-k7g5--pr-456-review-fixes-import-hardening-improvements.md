---
# ps-k7g5
title: "PR #456 review fixes: import hardening improvements"
status: completed
type: task
priority: normal
created_at: 2026-04-16T12:15:19Z
updated_at: 2026-04-19T22:56:38Z
parent: ps-0enb
---

Implement fixes from multi-agent review of PR #456 (fix/m9-import-hardening). 3 important issues + 7 suggestions covering response size guards, error handling, type safety, and tests.

## Tasks

- [x] Step 1: Unify response size guard (I1+I2) in api-source.ts
- [x] Step 2: Guard recordError in failed branch (I3)
- [x] Step 3: Hoist singleStateRef (S1)
- [x] Step 4: Extract CheckpointStateRef type (S2)
- [x] Step 5: Replace upsert switch with map (S3)
- [x] Step 6: Add boundary/edge-case response size tests (S4)
- [x] Step 7: Add persistMapperResult integration tests (S5)
- [x] Step 8-9: Verify PK coverage + PrivacyRecordSchema (no code changes)

## Summary of Changes

**import-sp/src/sources/api-source.ts** — Unified response size guard: all responses now go through `response.text()` + `new Blob([text]).size` + `JSON.parse`, preventing lying Content-Length from bypassing the size check. Removed dead `response.json()` path.

**import-core/src/import-engine.ts** — (1) Wrapped `persister.recordError()` in the mapper-failed branch with try-catch to prevent contract violations from escalating. (2) Extracted `CheckpointStateRef` type and annotated both call sites. (3) Replaced 14-line upsert switch with `UPSERT_ACTION_TO_DELTA` map lookup. (4) Hoisted `singleStateRef` before the `for await` loop, reusing the object each iteration.

**import-sp tests** — Added exact 50 MiB boundary test, non-numeric Content-Length fallback test, and updated text fallback test to stub Blob instead of TextEncoder.

**import-core tests** — Added 2 focused persistMapperResult integration tests verifying stateRef propagation on fatal abort and non-fatal mapper failure.

**Steps 8-9** — No code changes needed (existing coverage confirmed adequate; PrivacyRecordSchema looseness is by design).
