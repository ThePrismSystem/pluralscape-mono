---
# api-qg7t
title: Add key rotation retry endpoint
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T00:38:29Z
parent: api-e7gt
---

Bucket key rotation has initiate/claim/complete/progress endpoints but no retry endpoint for failed rotations.

Audit ref: Domain 11, gap 1

## Summary of Changes\n\n- Added retryRotation() service function resetting failed items to pending\n- Created POST /:rotationId/retry route handler\n- 5 unit tests
