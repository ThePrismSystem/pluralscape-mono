---
# ps-0lcl
title: Audit log hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:41Z
updated_at: 2026-04-04T19:31:37Z
parent: ps-j47j
---

Paginated query, filters

Uses trpc.account.auditLog for paginated queries and filters.

## Summary of Changes

Implemented audit log hook (read-only, account-level):

- useAuditLog (paginated query with eventType, resourceType, date range filters)

No mutations — audit log is append-only. All tests passing.
