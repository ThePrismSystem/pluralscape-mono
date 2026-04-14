---
# sync-kf0y
title: Add signature verification for snapshot submissions
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:45Z
updated_at: 2026-04-14T10:29:03Z
---

AUDIT [SYNC-S-M2] handleSubmitSnapshot calls relay.submitSnapshot with no envelope signature verification. Change envelopes are verified; snapshots are not. File: apps/api/src/ws/handlers.ts:270

## Summary of Changes

Extracted verifyEnvelopeOrError helper from handleSubmitChange. Applied signature verification and key ownership check to handleSubmitSnapshot (was previously unverified). Both change and snapshot submissions now share the same verification pipeline.
