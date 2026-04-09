---
# ps-096h
title: "PR #401 review fixes (critical + important + suggestions)"
status: completed
type: task
priority: normal
created_at: 2026-04-09T08:20:59Z
updated_at: 2026-04-09T10:56:01Z
parent: ps-nrg4
---

Address all findings from the multi-agent review of PR #401 (Simply
Plural import foundation, Plan 1 of 3). Fixes 6 critical, 11 important,
and 9 suggestion-level items plus the failing OpenAPI CI check.

## Spec and Plan

- Design: `docs/superpowers/specs/2026-04-09-pr-401-review-fixes-design.md`
- Plan: `docs/superpowers/plans/2026-04-09-pr-401-review-fixes.md`

## Commits

- [x] Commit 1: docs(openapi): add import-jobs and import-entity-refs paths (C1, S7) — 2e40c138
- [x] Commit 2: fix(mobile,sync): handle nullable poll createdByMemberId (C2) — 346b1a29
- [x] Commit 3: refactor(types): tighten import types and dedupe enums (I5, I6, I7, I8, I9, S1, S2, S3) — 0223af2d
- [x] Commit 4: fix(api): enforce import-job state machine and seed checkpoint (C3, C4, S5) — d5f5fb0e
- [x] Commit 5: fix(api): runtime-validate jsonb and harden route validation (I1, I2, I4, S4) — d4bc4bb6
- [x] Commit 6: fix(api): make recordImportEntityRef idempotent under race (I3) — f430dd70
- [x] Commit 7: test(api,db): cover import e2e, rls, and branch gaps (C5, C6, I10) — 746ba825
- [x] Commit 8: chore(api): import route ordering and shared constants (I11, S8, S9) — 4ef7232c
- [x] Commit 9 (out-of-band): chore(deps): bump nodemailer to 8.0.5 for SMTP injection fix — 8019cad3
- [x] Push and verify CI green (OpenAPI reconciliation unblocked)

## Summary of Changes

All critical, important, and suggestion-level findings from the multi-agent
review of PR #401 are addressed. The previously-failing OpenAPI Spec
Reconciliation check is now green and every other CI check passes.

### What landed

- **Commit 1 (2e40c138)** — OpenAPI YAMLs added for import-jobs and
  import-entity-refs (closes failing reconciliation check)
- **Commit 2 (346b1a29)** — null-safe poll createdByMemberId in mobile and sync
- **Commit 3 (0223af2d)** — discriminated unions for ImportError and
  ImportEntityRef, SSOT enum tuples, ImportCollectionType, parity guards
- **Commit 4 (d5f5fb0e)** — import-job state machine, checkpoint seeding,
  audit events for completion/failure, SELECT...FOR UPDATE locking
- **Commit 5 (d4bc4bb6)** — runtime JSONB validation (errorLog,
  checkpointState), Zod query validation on routes
- **Commit 6 (f430dd70)** — idempotent recordImportEntityRef via ON CONFLICT
  DO NOTHING + divergence check
- **Commit 7 (746ba825)** — coverage sweep: e2e import lifecycle, RLS for
  import_jobs and import_entity_refs, branch coverage gaps; surfaced and
  fixed two production bugs (cursor pagination, missing audit_log CHECK
  constraint via migration 0003)
- **Commit 8 (4ef7232c)** — import-entity-refs sub-routes mounted with
  explicit /lookup and / sub-prefixes; api-client types regenerated
- **Commit 9 (8019cad3, out-of-band)** — bumped nodemailer to 8.0.5 to
  resolve GHSA-vvjj-xcjg-gr5g (CI Security Audit gate)

### Verification

- Final pnpm test: 13602 tests / 883 files passing
- Final pnpm test:e2e: 465 tests passing
- pnpm openapi:check: 311 routes / 311 operations, no discrepancies
- pnpm trpc:parity, pnpm scope:check, pnpm lint, pnpm typecheck, pnpm format: clean
- PR #401 CI: every check green (Lint, Typecheck, Tests, E2E, OpenAPI Spec
  Reconciliation, Migration Freshness, Scope Coverage, tRPC Parity,
  Security Audit, CodeQL, Semgrep)
