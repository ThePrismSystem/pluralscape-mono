---
# api-pb39
title: Webhook secret rotation endpoint
status: todo
type: feature
priority: normal
created_at: 2026-03-29T02:07:30Z
updated_at: 2026-03-29T03:03:50Z
parent: api-9wze
---

POST /systems/:systemId/webhook-configs/:webhookId/rotate-secret — generates new HMAC key, returns it once, preserves config ID and subscriptions. Needs OCC version check and cache invalidation.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
