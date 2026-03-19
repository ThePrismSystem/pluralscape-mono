---
# api-eeoh
title: Keep-alive heartbeat
status: todo
type: task
priority: low
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: api-n8wk
---

Send SSE comment line (\`: heartbeat\`) every 30 seconds to prevent proxy/load-balancer timeouts.

## Acceptance Criteria

- Comment line sent every 30s when no other events are pending
- No connection drop after 30s inactivity behind a reverse proxy
- Heartbeat interval configurable in constants file
- Does not interfere with event delivery (heartbeat skipped if real event sent recently)
- Unit test: verify heartbeat timing
