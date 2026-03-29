---
# api-pb39
title: Webhook secret rotation endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-29T02:07:30Z
updated_at: 2026-03-29T07:00:35Z
parent: api-9wze
---

POST /systems/:systemId/webhook-configs/:webhookId/rotate-secret — generates new HMAC key, returns it once, preserves config ID and subscriptions. Needs OCC version check and cache invalidation.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes\n\nImplemented in PR #313: POST rotate-secret endpoint with OCC version check and cache invalidation.
