---
# db-j4e6
title: Activate RLS tenant context in API layer
status: completed
type: task
priority: critical
created_at: 2026-03-24T21:48:47Z
updated_at: 2026-03-24T22:42:34Z
parent: ps-8al7
---

RLS policies are deployed but setTenantContext/setSystemId/setAccountId are never called from the API layer. Add middleware or per-service activation so RLS enforces tenant isolation as defense-in-depth.

**Audit ref:** Finding 1 (HIGH) — A01 Broken Access Control / EoP
**Files:** packages/db/src/rls/session.ts, apps/api/src/middleware/, apps/api/src/services/
**Evidence:** grep for setTenantContext in apps/api/ returns 0 matches

## Summary of Changes

Created withTenantTransaction/withAccountTransaction helpers in apps/api/src/lib/rls-context.ts. Updated 28 service files + 2 shared lib files to wrap database operations with RLS tenant context. 108 call sites now activate RLS GUC variables (app.current_system_id, app.current_account_id) before queries. Updated test mocks to support the execute() call from setTenantContext.
