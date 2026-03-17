---
# api-e0c2
title: Audit log write middleware
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:35Z
updated_at: 2026-03-17T08:39:37Z
parent: api-o89k
blocked_by:
  - api-5mzr
---

Reusable helper that writes audit log entries: accepts eventType, actor, detail, extracts IP/userAgent from request context. Pattern used by all subsequent epics. Insert into partitioned audit_log table.

## Summary of Changes

Created `createAuditWriter(c, auth?)` factory function in `apps/api/src/lib/audit-writer.ts` that returns a pre-bound `AuditWriter` function. The factory captures request metadata (IP, user-agent) from the Hono context at creation time and automatically includes accountId/systemId from auth context, with per-call override support. Includes 9 unit tests covering authenticated/unauthenticated routes, explicit overrides, IP extraction, user-agent capture, transaction passthrough, and multi-call reuse.
