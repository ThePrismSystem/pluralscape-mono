---
# api-u107
title: 'H4: Batch webhook delivery cleanup DELETE'
status: completed
type: task
created_at: 2026-03-29T09:52:35Z
updated_at: 2026-03-29T09:52:35Z
parent: api-hvub
---

Unbounded DELETE held long-running transactions. Changed to 1000-row batches. Fixed in PR #319.
