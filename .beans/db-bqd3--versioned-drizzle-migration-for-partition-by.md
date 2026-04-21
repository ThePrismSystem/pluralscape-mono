---
# db-bqd3
title: Versioned Drizzle migration for PARTITION BY
status: todo
type: task
priority: high
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-21T14:00:15Z
parent: ps-9u4w
---

Turn the hand-edited production PARTITION BY RANGE migration into a checked-in SQL migration under packages/db/migrations/pg/ so a fresh clone reproduces prod.

## Context

packages/db/src/schema/pg/audit-log.ts line 31 contains the comment `// NOTE: The production migration adds PARTITION BY RANGE ("timestamp") which Drizzle ...` — meaning partitioning exists operationally in prod but not in the versioned migration sequence. ADR-017 documents the decision; db-ahn1 implemented it via hand-editing. A new developer cloning the repo and running pnpm --filter @pluralscape/db migrate will NOT get the partitioning.

Three tables are affected per PARTITIONED_TABLES in packages/db/src/queries/partition-maintenance.ts: audit_log, messages, fronting_sessions.

## Scope

- [ ] Create packages/db/migrations/pg/0002_partitioning.sql (or next available number) containing the partitioning DDL for all three tables
- [ ] For each of audit_log / messages / fronting_sessions: convert the existing table to a partitioned parent + create initial monthly partitions (current month + N months ahead per pgEnsureFuturePartitions convention) + a default partition
- [ ] Handle the data migration path: if the existing table has rows, either copy into partitions or run this migration only on empty tables (document which)
- [ ] Add an integration test that spins up a fresh PGlite instance, runs all migrations in order, and asserts pg_inherits shows the expected partition hierarchy for each table
- [ ] Update packages/db/src/**tests**/rls-migrations.integration.test.ts filename reference if needed (per CLAUDE.md's migration regeneration note)
- [ ] Remove the "hand-edited migration" comment from audit-log.ts — the note becomes stale once this lands

## Out of scope

- Retention job wiring (sibling task)
- New partition scheme for any additional tables

## Acceptance

- pnpm vitest run --project db-integration passes including the new fresh-instance partitioning test
- pnpm typecheck passes
- Fresh clone + pnpm migrate produces a DB where audit_log / messages / fronting_sessions are partitioned
- Production deployment does NOT re-run this migration (idempotency or explicit guard)

## Priority

High — blocks reproducible production deploys for self-hosted installs.
