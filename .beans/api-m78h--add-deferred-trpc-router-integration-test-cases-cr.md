---
# api-m78h
title: Add deferred tRPC router integration test cases (cross-tenant writes, OCC conflicts, dependent-conflicts)
status: todo
type: task
created_at: 2026-04-20T04:08:11Z
updated_at: 2026-04-20T04:08:11Z
parent: ps-9u4w
---

Follow-up to PR #509 (test/trpc-router-integration). PR #509 established router integration test infrastructure and happy-path-per-procedure coverage for 15 routers. The PR-#509 cleanup pass deliberately deferred the following test additions to keep that PR focused on infrastructure and review-fix work.

## Scope

### Cross-tenant FORBIDDEN/NOT_FOUND coverage on write paths

Each router in PR #509 has exactly one cross-tenant test against `get`. Add cross-tenant tests for write paths on the highest-risk procedures:

- [ ] `system.purge` — destructive, account-scoped; highest-value missing test in the whole PR per the test-quality review
- [ ] `system.duplicate`, `system.archive` — also lack cross-tenant write coverage
- [ ] `bucket.assignFriend`, `bucket.tagContent`, `bucket.initiateRotation` — sensitive crypto / privacy operations
- [ ] `friend.accept`, `friend.block`, `friend.updateVisibility` — state-mutating, account-boundary
- [ ] `webhookConfig.rotateSecret` — sensitive credential rotation
- [ ] `structure.link.*`, `structure.memberLink.*`, `structure.association.*` — only entity + entityType have cross-tenant tests today

### OCC version-mismatch CONFLICT coverage

Add at least one conflict test per OCC-protected mutation surface:

- [ ] `bucket.update` — pass stale `version`, expect TRPCError code `CONFLICT`
- [ ] `webhookConfig.update`
- [ ] `structure.entity.update`
- [ ] Any other `*.update` procedure that takes a `version` arg (audit during implementation)

### 409 dependent-conflict coverage

Project rule: "409 if entity has dependents, `onDelete: restrict` on entity FKs". Verify the rule fires:

- [ ] `member.delete` with active fronting session — expect CONFLICT
- [ ] `structure.entityType.delete` with referencing entities — expect CONFLICT
- [ ] Other entity deletes with `onDelete: restrict` FKs (audit during implementation)

### Auth router consistency gaps

- [ ] `auth.session.revoke` and `auth.session.revokeAll` — add UNAUTHORIZED tests for parity with the rest of the auth router
- [ ] Re-tighten `auth.registrationCommit` invalid-input test — PR-#509 cleanup changed the bare `rejects.toThrow()` to `rejects.toThrow(expect.objectContaining({ code }))` empirically; verify the assertion still matches what the crypto path actually throws

### Strengthen smoke-level assertions

- [ ] `friend.exportData`, `friend.exportManifest`, `bucket.exportManifest`, `bucket.exportPage` — currently only `Array.isArray(...)`. Assert at least one populated row when the seed includes data.
- [ ] `archive` / `restore` / `delete` happy paths — add a follow-up `get` returning the archived/restored row instead of asserting only `result.success`.
- [ ] `bucket.retryRotation` happy path — currently only the rejection-on-non-failed-state path is tested.
- [ ] `structure.entity.getHierarchy` — happy path skipped due to PGlite vs postgres-js `tx.execute` shape divergence. Either add a service-level integration test, or normalize the result-row shape in the service so the happy path can be exercised here.

## Out of scope

- Remaining 23 routers (of 38) — separate follow-up bean (already noted in PR-#509 known follow-ups).
- Inlining the per-file `seedNote` / `seedImportJob` / `seedFieldDefinition` / `seedWebhookConfig` helpers — flagged by the simplifier as DRY-noise but deferred from PR-#509 cleanup; only revisit if we find them obscuring the tests.

## References

- PR #509: https://github.com/ThePrismSystem/pluralscape-mono/pull/509
- Original bean: `api-kt5h`
- PR-#509 cleanup spec (gitignored): `docs/superpowers/specs/2026-04-19-pr509-cleanup-design.md`
