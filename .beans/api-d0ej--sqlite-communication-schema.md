---
# api-d0ej
title: SQLite communication schema
status: todo
type: task
priority: critical
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T05:59:18Z
parent: api-ryy0
---

Create packages/db/src/schema/sqlite/communication.ts mirroring PG schema (channels, messages, board_messages, notes, polls, poll_votes, acknowledgements). Generate SQLite migrations. Tests: unit test verifying schema parity with PG. Shared dependency for all M5 epics.
