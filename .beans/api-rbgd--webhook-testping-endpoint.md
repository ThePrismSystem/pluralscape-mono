---
# api-rbgd
title: Webhook test/ping endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-29T02:08:04Z
updated_at: 2026-03-29T07:00:36Z
parent: api-9wze
---

POST /systems/:systemId/webhook-configs/:webhookId/test — sends a synthetic delivery inline (not queued) and returns the result so users can verify their endpoint.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes\n\nImplemented in PR #313: POST test/ping endpoint sending synthetic delivery inline with result returned.
