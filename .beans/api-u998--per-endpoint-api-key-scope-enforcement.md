---
# api-u998
title: Per-endpoint API key scope enforcement
status: in-progress
type: feature
priority: normal
created_at: 2026-04-06T14:28:06Z
updated_at: 2026-04-06T19:02:59Z
---

Add scope checking to all system-scoped endpoints. Each endpoint should validate that the API key's scopes include the required scope for that operation (e.g., read:members for GET /members). The AuthContext.apiKeyScopes field is already populated by the auth middleware (added in security audit remediation). This task adds requireScope() checks to route handlers and tRPC procedures.

Scopes to enforce: read:members, write:members, read:fronting, write:fronting, read:groups, write:groups, read:system, write:system, read:webhooks, write:webhooks, read:audit-log, read:blobs, write:blobs, read:notifications, write:notifications, full.
