---
# api-lh91
title: Fix system delete to support permanent purge
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:25Z
updated_at: 2026-03-30T01:01:46Z
parent: api-e7gt
---

DELETE /systems/:id currently calls archiveSystem() (soft delete). No separate hard-delete/purge path exists. Need either a separate purge endpoint or a force parameter.

Audit ref: Domain 3, gap 3

## Summary of Changes\n\n- Created system-purge.service.ts with password-verified hard delete\n- Created POST /:id/purge route requiring archived status\n- Added PurgeSystemBodySchema validation\n- 7 unit tests
