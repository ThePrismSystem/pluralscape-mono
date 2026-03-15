---
# api-koty
title: Implement rotation API endpoints
status: todo
type: task
priority: normal
created_at: 2026-03-09T12:42:38Z
updated_at: 2026-03-15T07:13:05Z
parent: crypto-gd8f
blocked_by:
  - crypto-gkaa
  - api-g954
---

Server endpoints for lazy key rotation (ADR 014): POST initiate rotation (steps 1-7), GET/POST chunk claim mechanism (50-item default, 5-min stale timeout), POST chunk completion, GET rotation progress, rotation state transitions (initiated → migrating → sealing → completed/failed). Include concurrent rotation serialization (max 1 active per bucket).
