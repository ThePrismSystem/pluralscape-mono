---
# api-6l1q
title: API service layer refactor
status: completed
type: epic
priority: normal
created_at: 2026-04-21T13:54:28Z
updated_at: 2026-04-22T09:21:23Z
parent: ps-cd6x
---

Refactor the 15 service files in apps/api/src/services/ that exceed 500 LOC into services/<domain>/<verb>.ts structure with each file ≤300 LOC. Splits typically go along verbs (create.ts, update.ts, archive.ts, permissions.ts, queries.ts) plus a domain-local index.ts re-exporter so route-layer import paths stay stable.

## Target files (one child task per file, parallelizable)

| File                         | LOC |
| ---------------------------- | --- |
| member.service.ts            | 840 |
| webhook-config.service.ts    | 728 |
| auth.service.ts              | 728 |
| fronting-session.service.ts  | 666 |
| key-rotation.service.ts      | 658 |
| friend-connection.service.ts | 634 |
| field-definition.service.ts  | 599 |
| check-in-record.service.ts   | 590 |
| member-photo.service.ts      | 589 |
| board-message.service.ts     | 552 |
| innerworld-region.service.ts | 544 |
| import-entity-ref.service.ts | 538 |
| fronting-comment.service.ts  | 523 |
| poll-vote.service.ts         | 521 |
| group.service.ts             | 515 |

## Parallelization

No cross-blockers between child beans — each refactor is a per-file boundary and can run in a worktree agent independently. Child beans keep existing public exports stable so callers don't need touch-ups.

## Regression prevention

A separate closeout-quick-wins bean adds a CI/pre-commit cap of 500 LOC on apps/api/src/services/\*_/_.ts to prevent regression.

## Spec reference

docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md

## Summary of Changes

All 8 remaining follow-up beans closed in this closeout PR. Epic complete: 41 service files refactored across 3 PRs (#535 — 15 files ≥500 LOC; #536 — 26 files 300-500 LOC; this PR — 7 follow-up cleanups + shared checkDependents helper migrating 13 consumers). API service layer now fully per-verb (Option E, no barrels). ESLint max-lines cap on services/\*\* tightened from 500 → 450 (observed post-refactor max: 408 in hierarchy-service-factory.ts).
