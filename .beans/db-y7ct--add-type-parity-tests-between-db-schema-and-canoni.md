---
# db-y7ct
title: Add type parity tests between DB schema and canonical types
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-13T00:03:54Z
parent: db-gwpb
---

Tests insert/select only current Drizzle columns — suite stays green while DB drifts from packages/types. Add parity checks. Ref: audit M30
