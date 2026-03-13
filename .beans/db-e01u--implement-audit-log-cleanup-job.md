---
# db-e01u
title: Implement audit-log-cleanup job
status: completed
type: task
priority: normal
created_at: 2026-03-12T20:22:59Z
updated_at: 2026-03-12T23:51:48Z
---

Implement the audit-log-cleanup background job: delete/archive audit log entries older than N days. Job type added in this batch (S4/S5).

## Summary of Changes

Implemented audit-log-cleanup query functions (pgCleanupAuditLog, sqliteCleanupAuditLog with batch-size support) and 5 integration tests.
