---
# api-nk7m
title: Recovery key regeneration email confirmation
status: todo
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

M5: Send email confirmation when a recovery key is regenerated to alert account owner.

## Acceptance Criteria

- Email sent to account's verified email address on recovery key regeneration
- Email contains: timestamp, device/session info (if available), instructions if not initiated by owner
- Email is non-blocking (queued via job system, regeneration doesn't wait for delivery)
- Integration test: regenerate recovery key → verify email job enqueued with correct recipient
