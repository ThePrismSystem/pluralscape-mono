---
# db-xzj3
title: Implement rotation ledger DB schema
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:42:34Z
updated_at: 2026-03-12T23:20:03Z
parent: crypto-gd8f
blocked_by:
  - crypto-gkaa
---

Create Drizzle schema for bucket_key_rotations and bucket_rotation_items tables as specified in ADR 014. Tables track rotation state machine progress as T3 metadata (no key material). Include: rotation ID, bucketId, fromKeyVersion, toKeyVersion, state enum, timestamps, item-level status/claim tracking with stale timeout support.

## Summary of Changes\n\nVerified schema already exists at:\n- `packages/db/src/schema/pg/key-rotation.ts`\n- `packages/db/src/schema/sqlite/key-rotation.ts`\n\nBoth implement `bucketKeyRotations` and `bucketRotationItems` with all ADR 014 requirements (state machine, claim tracking, CHECK constraints).
