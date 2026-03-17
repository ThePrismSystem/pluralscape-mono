---
# api-fmxj
title: Refactor auth/system endpoints to use createAuditWriter
status: completed
type: task
priority: normal
created_at: 2026-03-17T08:50:04Z
updated_at: 2026-03-17T08:59:30Z
---

Replace extractRequestMeta + writeAuditLog pattern with createAuditWriter factory across 9 route handlers, 4 services, and their tests

## Summary of Changes\n\nRefactored all auth and system endpoints to use the createAuditWriter factory instead of manually threading extractRequestMeta + writeAuditLog.\n\n- 4 service files: replaced requestMeta parameter with audit: AuditWriter, replaced 12 writeAuditLog call sites with audit() calls\n- 9 route files: replaced extractRequestMeta(c) with createAuditWriter(c, auth)\n- 11 route test files: replaced extractRequestMeta mock with createAuditWriter mock\n- 4 service test files: replaced requestMeta objects with mock AuditWriter functions\n- 1 benchmark file: updated to use createAuditWriter
