---
# db-gxrb
title: SQLite jobs table under-implements ADR 010
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

ADR 010 expects retry/backoff, DLQ semantics, heartbeat/timeout. SQLite jobs table lacks heartbeat, result, scheduling fields. systemId is nullable — weakens tenant attribution. Decide if minimal-and-lossy or should satisfy ADR 010. Ref: audit H13
