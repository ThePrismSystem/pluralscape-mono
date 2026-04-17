---
# ps-jdl9
title: "Import packages: security, dedup, and testing"
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:17Z
updated_at: 2026-04-17T05:46:29Z
parent: ps-0enb
---

Low-severity import-sp, import-pk, and import-core findings from comprehensive audit.

## Findings

- [ ] [IMPORTSP-S-L1] Response body size not bounded for API source
- [ ] [IMPORTSP-S-L2] SPMemberSchema.info accepts **proto** keys
- [ ] [IMPORTPK-T-L1] privacy cast loses PKPrivacySchema enum constraint
- [ ] [IMPORTCORE-P-L1] Checkpoint writes every 50 docs without intermediate flushing
- [ ] [IMPORTCORE-T-L1] collectionToEntityType called with "unknown" fallback
- [ ] [IMPORTCORE-S-L1] Single-mapper and batch-mapper paths have ~150 lines duplicated
- [ ] [IMPORTSP-TC-L1] No test for corrupted prescan state
- [ ] [IMPORTPK-TC-L1] No adversarial test for **proto**/constructor key injection
- [ ] [IMPORTCORE-TC-L1] No test for empty dependencyOrder

## Summary of Changes

Completed via PR #456 (`fix(import): security bounds, type safety, dedup, and test coverage`).

- Bounded API source response size to 50 MiB before JSON parsing (`SP_API_MAX_RESPONSE_BYTES` enforced in `api-source.ts:261`)
- Removed widening privacy cast in PK file source
- Throw on empty `dependencyOrder` instead of "unknown" fallback
- Extracted shared mapper result processing helper to reduce duplication
- Added tests for corrupted prescan, proto injection, empty dependencies
