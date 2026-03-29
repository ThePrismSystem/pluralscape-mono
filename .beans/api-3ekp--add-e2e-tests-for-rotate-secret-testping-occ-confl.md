---
# api-3ekp
title: Add E2E tests for rotate-secret, test/ping, OCC conflict
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

webhook-flow.spec.ts covers happy path only. Missing E2E coverage for: secret rotation (POST /webhook-configs/:id/rotate-secret), test/ping endpoint (POST /webhook-configs/:id/test), OCC conflict on stale version update (409), HAS_DEPENDENTS error on delete with pending deliveries (409).
