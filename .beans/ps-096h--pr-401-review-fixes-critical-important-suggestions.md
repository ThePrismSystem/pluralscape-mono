---
# ps-096h
title: "PR #401 review fixes (critical + important + suggestions)"
status: in-progress
type: task
priority: normal
created_at: 2026-04-09T08:20:59Z
updated_at: 2026-04-09T10:29:02Z
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
- [x] Commit 8: chore(api): import route ordering and shared constants (I11, S8, S9)
- [ ] Push and verify CI green (OpenAPI reconciliation unblocked)
