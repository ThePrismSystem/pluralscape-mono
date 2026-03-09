---
# db-xzj3
title: Implement rotation ledger DB schema
status: todo
type: task
priority: normal
created_at: 2026-03-09T12:42:34Z
updated_at: 2026-03-09T12:42:57Z
parent: crypto-gd8f
blocked_by:
  - crypto-gkaa
---

Create Drizzle schema for bucket_key_rotations and bucket_rotation_items tables as specified in ADR 014. Tables track rotation state machine progress as T3 metadata (no key material). Include: rotation ID, bucketId, fromKeyVersion, toKeyVersion, state enum, timestamps, item-level status/claim tracking with stale timeout support.
