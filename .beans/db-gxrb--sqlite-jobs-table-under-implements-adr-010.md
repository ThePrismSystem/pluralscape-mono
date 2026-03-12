---
# db-gxrb
title: SQLite jobs table under-implements ADR 010
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T04:11:20Z
parent: db-q3r3
---

ADR 010 expects retry/backoff, DLQ semantics, heartbeat/timeout. SQLite jobs table lacks heartbeat, result, scheduling fields. systemId is nullable — weakens tenant attribution. Decide if minimal-and-lossy or should satisfy ADR 010. Ref: audit H13

## Summary of Changes

Added dead-letter status to JobStatus union and JOB_STATUSES enum. Added 5 new columns to SQLite jobs table (lastHeartbeatAt, timeoutMs, result, scheduledFor, priority) with appropriate defaults. Added 2 CHECK constraints (attempts <= maxAttempts, timeoutMs > 0) and 2 indexes (priority/status/scheduled, heartbeat). Updated DDL helpers and integration tests.
