---
# db-2qv7
title: Right-size varchar(255) ID columns
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

All IDs use varchar(255). If UUIDs (36 chars), this wastes ~6x storage. Consider varchar(36), char(36), or native uuid type. At 9B message rows, this is ~180GB wasted in PKs and FK columns alone. All three models flagged this. Ref: audit L1
