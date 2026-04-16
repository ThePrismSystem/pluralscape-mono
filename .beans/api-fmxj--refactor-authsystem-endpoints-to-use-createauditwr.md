---
# api-fmxj
title: Refactor auth/system endpoints to use createAuditWriter
status: completed
type: task
priority: normal
created_at: 2026-03-17T08:50:04Z
updated_at: 2026-04-16T07:29:43Z
parent: api-o89k
---

Replace extractRequestMeta + writeAuditLog pattern with createAuditWriter factory across 9 route handlers, 4 services, and their tests

## Summary of Changes

Refactored all auth and system endpoints to use the createAuditWriter factory instead of manually threading extractRequestMeta + writeAuditLog.

- 4 service files: replaced requestMeta parameter with audit: AuditWriter, replaced 12 writeAuditLog call sites with audit() calls
- 9 route files: replaced extractRequestMeta(c) with createAuditWriter(c, auth)
- 11 route test files: replaced extractRequestMeta mock with createAuditWriter mock
- 4 service test files: replaced requestMeta objects with mock AuditWriter functions
- 1 benchmark file: updated to use createAuditWriter
