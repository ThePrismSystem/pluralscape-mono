---
# api-lu29
title: CI script to verify all API endpoints have required security middleware
status: draft
type: task
created_at: 2026-04-06T18:37:34Z
updated_at: 2026-04-06T18:37:34Z
---

Create a CI check that verifies every REST route and tRPC procedure has all required security middleware applied: auth gating, rate limiting, API key scope enforcement, idempotency (for mutations). Should fail CI if any endpoint is missing a required middleware layer. Follow-up from api-u998 (scope enforcement).
