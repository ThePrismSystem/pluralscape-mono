---
# db-d2ht
title: audit_log retention/drop job in packages/rotation-worker
status: todo
type: task
priority: high
created_at: 2026-04-21T14:00:15Z
updated_at: 2026-04-21T14:00:15Z
parent: ps-9u4w
---

Wire the existing pgDetachOldPartitions function into a scheduled recurring job that drops audit_log monthly partitions older than a configurable retention window. Closes the gap where partitioning exists but no process ever drops old partitions.

## Context

packages/db/src/queries/partition-maintenance.ts exports pgDetachOldPartitions (DetachableTable = "audit_log") which detaches + drops partitions older than N months. It is fully tested (packages/db/src/**tests**/queries-pg-partition-maintenance.test.ts) but nothing invokes it on a schedule. ADR-017 (Audit Log Partitioning) assumes "90 days hot, archive cold" as the retention policy but the retention half never shipped — db-ahn1 only delivered the partitioning itself.

Other related completed beans: api-0kdf (audit log PII cleanup job) handles PII redaction, not partition drop. api-enp2 was scrapped in favor of infra-gvgo which covers PII only.

## Scope

- [ ] Add a new recurring job type (audit-log-partition-retention) in apps/api/src/workers/ or packages/rotation-worker/ depending on where recurring jobs live
- [ ] Handler calls pgDetachOldPartitions with { table: "audit_log", olderThanMonths: env.AUDIT_LOG_RETENTION_MONTHS ?? 12 }
- [ ] Add AUDIT_LOG_RETENTION_MONTHS env var with validation in apps/api/src/env.ts (positive integer, default 12)
- [ ] Schedule with a BullMQ repeatable (weekly) plus a SQLite fallback for self-hosted deployments
- [ ] Add integration test: insert rows into multiple monthly partitions spanning > retention window, run handler, assert older partitions are detached and dropped, newer ones survive
- [ ] Document the env var + schedule in CLAUDE.md / docs/operations.md
- [ ] Cross-reference ADR-017; either update the ADR status or add a note that the retention half now ships

## Out of scope

- Partitioning messages or fronting_sessions (ADR-017 explicitly never drops those automatically)
- Versioned Drizzle migration for PARTITION BY (sibling task under M15)
- PII redaction (already shipped as api-0kdf)

## Acceptance

- pnpm vitest run --project db-integration passes the new retention test
- pnpm typecheck passes
- Job visible in /admin/jobs or equivalent job inventory
- Env var documented

## Priority

High — blocks a clean production deployment story for self-hosted installs where disk pressure matters.
