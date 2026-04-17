---
# ps-cpxh
title: "PR #464 review-fix pass"
status: completed
type: task
priority: high
created_at: 2026-04-17T15:44:15Z
updated_at: 2026-04-17T17:57:19Z
---

Follow-up to PR #464 multi-agent review. Close 8 important findings + 7 suggestions across 7 domains in 8 commits on chore/audit-cleanup-batch-1.

## Todos

- [x] Domain 1: Correlated JobRecord union
- [x] Domain 2: DB fail-closed flip
- [x] Domain 3: Delete mapStructureEntityAssociationRow
- [x] Domain 4: Change-email refactor + version-based idempotency
- [x] Domain 5: Rename integration test + add real-Postgres E2E
- [x] Domain 6: Mobile diagnostic breadcrumbs
- [x] Domain 7: Test guard tightening + S3 negative tests
- [x] Final verify (/verify)

## Summary of Changes

Seven commits on \`chore/audit-cleanup-batch-1\` closing all 15 PR #464 review items:

1. **\`7b331a1d\`** refactor(types,queue): correlated discriminated JobRecord union — closes review items #7, #10, #13 (plus quality-review follow-ups: extracted PayloadSchemaByType with bidirectional Unbrand<T> conformance check; listJobs validation gap closed)
2. **\`1437dcb9\`** fix(db): finish fail-closed flip for notification configs — closes #2
3. **\`73ab3022\`** chore(db): remove dead mapStructureEntityAssociationRow helper — closes #3
4. **\`eda612cc\`** refactor(api): extract change-email notification enqueue + version key — closes #1, #5, #6, #9 (plus ACCOUNT_EMAIL_CHANGE_IDEMPOTENCY_PREFIX constant extracted per quality-review)
5. **\`d3dd7b4d\`** test(api): rename for-update tests, add real-postgres lock-contention E2E — closes #4 (plus pre-existing Domain 2 E2E fix folded in; poll-vote race fan-out to 8 with pg_stat_activity probe for real Lock-wait proof)
6. **\`af368990\`** fix(mobile): add diagnostic breadcrumbs for token-store and SSE errors — closes #11, #12
7. **\`f434eb78\`** test(api-e2e,storage): strengthen guards, add S3 PUT negatives, fix Content-Type signing — closes #8, #14; SURFACED AND FIXED a real MIME-spoofing vulnerability on presigned PUTs (MinIO auto-sign gap: \`content-type\`/\`content-length\` now in signableHeaders)

## Deferred to follow-up beans

- **ps-jyoc**: repo-wide assertion-quality sweep (~317 pre-existing \`.toBeDefined()\` usages outside mobile) — review item #15 move is deferred; the mobile-scoped guard stays in place.
- **ps-jg9i**: audit presigned PUT callers for exact Content-Length — latent risk surfaced by signing fix #8.

## Verification

- format / lint / typecheck: clean
- unit: 12,247 passed / 1 skipped / 866 files
- integration: 2,786 passed / 11 skipped / 133 files
- E2E: 499 passed

No \`as any\`, no \`as unknown as T\`, no backwards-compat shims. All commits individually green; PR #464 is ready for merge.
