---
# api-mkzj
title: Add per-IP WebSocket connection limiting
status: completed
type: task
priority: high
created_at: 2026-03-24T21:49:07Z
updated_at: 2026-03-24T22:15:32Z
parent: ps-8al7
---

WebSocket unauthed connection cap (500) is global, not per-IP. Single attacker can exhaust all slots (Slowloris). Add per-IP tracking with ~50 connection limit per IP.

**Audit ref:** Finding 5 (MEDIUM) — A04 Insecure Design / DoS
**Files:** apps/api/src/ws/ws.constants.ts:30-31, apps/api/src/ws/connection-manager.ts:31-39

## Summary of Changes

Added per-IP unauthenticated connection tracking to ConnectionManager (ipUnauthCount Map). Follows TRUST_PROXY pattern: disabled when TRUST_PROXY=0. IP threaded through connection lifecycle (reserve, register, authenticate, remove, shutdown).
