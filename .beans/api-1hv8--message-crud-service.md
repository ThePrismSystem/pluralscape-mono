---
# api-1hv8
title: Message CRUD service
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T07:22:57Z
parent: api-ryy0
blocked_by:
  - api-258a
  - api-d0ej
---

apps/api/src/services/message.service.ts — Create (with replyToId, mentions), get, list (cursor pagination by timestamp), update (edit), archive/restore, delete. Handles partitioned messages table (ADR 016). Tests: unit (all branches) + integration (real DB, partition-aware queries). 85%+ coverage.

## Summary of Changes\n\nImplemented message CRUD service with partition-aware composite cursor pagination (timestamp, id), optional timestamp hint for partition pruning, and full integration test suite.
