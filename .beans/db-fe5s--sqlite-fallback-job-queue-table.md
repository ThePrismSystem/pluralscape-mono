---
# db-fe5s
title: SQLite fallback job queue table
status: todo
type: task
created_at: 2026-03-08T14:22:38Z
updated_at: 2026-03-08T14:22:38Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Simple job queue table for SQLite-backed minimal self-hosted tier (single-worker fallback for BullMQ).

## Scope

- `jobs`: id, type (varchar), payload (text — JSON), status ('pending'|'processing'|'completed'|'failed'), attempts (integer default 0), max_attempts (integer default 5), next_retry_at (timestamp nullable), error (text nullable), created_at, started_at (nullable), completed_at (nullable)
- Indexes: jobs (status, next_retry_at) for queue polling, jobs (type) for type filtering
- Design: simple single-worker queue — no concurrency control needed
- Design: SQLite-only table (not needed for PostgreSQL tier which uses BullMQ/Valkey)
- Idempotency: optional idempotency_key (varchar unique nullable) to prevent duplicate jobs

## Acceptance Criteria

- [ ] jobs table with retry tracking
- [ ] Idempotency key support
- [ ] Indexes for efficient queue polling
- [ ] SQLite migration only (not PG)
- [ ] Integration test: enqueue, dequeue, retry, complete job lifecycle

## References

- ADR 010 (Background Jobs — SQLite fallback)
- ADR 012 (Minimal self-hosted tier)
