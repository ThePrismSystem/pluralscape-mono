---
# api-av1h
title: Refactor check-in-record.service.ts (590 LOC) into services/check-in-record/
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:56:56Z
updated_at: 2026-04-21T22:04:29Z
parent: api-6l1q
---

Split apps/api/src/services/check-in-record.service.ts (590 LOC) into apps/api/src/services/check-in-record/ with per-verb files, each ≤300 LOC. Follows the pattern established by api-trlq (member.service.ts refactor).

## Context

Currently concentrates timer-triggered check-ins / response lifecycle / dismissal in a single file. Splitting along verbs (create / update / archive / queries / permissions) makes the unit of change smaller and the domain-local permissions logic discoverable.

## Scope

- [ ] Create apps/api/src/services/check-in-record/ directory
- [ ] Split into per-verb files with index.ts re-exporter so caller imports stay stable
- [ ] Keep existing public exports identical
- [ ] Preserve all existing tests; no coverage regression
- [ ] Each resulting file ≤300 LOC; stretch target 200 LOC
- [ ] Follow the conventions established by api-trlq

## Out of scope

- Changing public signatures
- Refactoring related services (tracked in sibling beans under api-6l1q)

## Acceptance

- apps/api/src/services/check-in-record.service.ts no longer exists
- pnpm vitest run --project api passes
- pnpm vitest run --project api-integration passes
- pnpm typecheck passes
- No file in apps/api/src/services/check-in-record/ exceeds 300 LOC

## Parallelization

No cross-blockers with other service refactor beans — safe to run in a worktree agent concurrently with siblings.

## Findings

- apps/api/src/services/check-in-record.service.ts — split 590 LOC monolith into 9 verb files under services/check-in-record/ (no barrel) — INFO
- shared helpers toCheckInRecordResult (used across create/list/get/respond/dismiss/restore) and fetchPendingCheckIn (used by respond+dismiss) placed in internal.ts — INFO
- CheckInRecordListOptions, CheckInRecordResult types moved to internal.ts and re-exported from list.ts as types — INFO
- 8 callers updated (3 tests mocking the service needed vi.mock path fan-out to per-verb files) — INFO

## Summary of Changes

check-in-record.service.ts (590 LOC) → services/check-in-record/ (9 files). Max 140 LOC. 11 caller files (17 import sites). No barrel (Option E).

Merged into feat/api-service-refactor-pr1. Full /verify green (run 30714).
