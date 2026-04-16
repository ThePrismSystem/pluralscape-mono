---
# api-u998
title: Per-endpoint API key scope enforcement
status: completed
type: feature
priority: normal
created_at: 2026-04-06T14:28:06Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
---

Add scope checking to all system-scoped endpoints. Each endpoint should validate that the API key's scopes include the required scope for that operation (e.g., read:members for GET /members). The AuthContext.apiKeyScopes field is already populated by the auth middleware (added in security audit remediation). This task adds requireScope() checks to route handlers and tRPC procedures.

Scopes to enforce: read:members, write:members, read:fronting, write:fronting, read:groups, write:groups, read:system, write:system, read:webhooks, write:webhooks, read:audit-log, read:blobs, write:blobs, read:notifications, write:notifications, full.

## Summary of Changes

- Expanded ApiKeyScope from 16 to 71 values with three-tier hierarchy (read < write < delete)
- Added 22 scope domains covering all entity types, derived programmatically from SCOPE_DOMAINS
- Implemented hasScope() pure predicate with aggregate scope expansion (read-all, write-all, delete-all, full)
- Created Hono requireScopeMiddleware() and tRPC requireScope() middleware
- Added scope enforcement to all system-scoped REST routes (~262 files) and tRPC procedures (~31 routers, ~288 procedures)
- API key management endpoints require full scope
- Updated tRPC parity script with scope enforcement as 5th check dimension (262 comparisons)
- Unit tests for hasScope() covering all hierarchy paths
- Updated DB enum tests for expanded scope count
