---
# sync-kf0y
title: Add signature verification for snapshot submissions
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:45Z
updated_at: 2026-04-14T09:28:45Z
---

AUDIT [SYNC-S-M2] handleSubmitSnapshot calls relay.submitSnapshot with no envelope signature verification. Change envelopes are verified; snapshots are not. File: apps/api/src/ws/handlers.ts:270
