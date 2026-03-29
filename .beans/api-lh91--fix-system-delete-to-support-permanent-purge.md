---
# api-lh91
title: Fix system delete to support permanent purge
status: todo
type: task
priority: high
created_at: 2026-03-29T21:31:25Z
updated_at: 2026-03-29T21:31:25Z
parent: api-e7gt
---

DELETE /systems/:id currently calls archiveSystem() (soft delete). No separate hard-delete/purge path exists. Need either a separate purge endpoint or a force parameter.

Audit ref: Domain 3, gap 3
