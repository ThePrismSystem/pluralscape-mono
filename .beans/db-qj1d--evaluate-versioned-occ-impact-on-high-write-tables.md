---
# db-qj1d
title: Evaluate versioned() OCC impact on high-write tables
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

Optimistic locking via version increment on every update adds write to high-frequency tables. At scale, verify OCC retry rates don't cause hot-row contention. Ref: audit L7
