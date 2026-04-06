---
# ps-qg8g
title: Add jitter to SSE reconnect backoff
status: completed
type: bug
priority: high
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T05:20:00Z
parent: ps-y621
---

SSE ConnectionManager uses exponential backoff without jitter. WsManager correctly uses jitter, but SSE does not. On server restart, all clients retry at identical intervals (thundering herd).

Fix: add jitter to ConnectionStateMachine.getBackoffMs() matching WsManager pattern.

File: apps/mobile/src/connection/connection-manager.ts:84
Audit ref: Pass 3 HIGH

## Summary of Changes\n\nAdded ±25% jitter to SSE reconnect backoff matching WsManager pattern. Updated existing tests to assert ranges.
