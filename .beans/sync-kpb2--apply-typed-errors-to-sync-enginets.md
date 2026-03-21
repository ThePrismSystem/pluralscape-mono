---
# sync-kpb2
title: Apply typed errors to sync-engine.ts
status: todo
type: task
priority: low
created_at: 2026-03-21T00:34:19Z
updated_at: 2026-03-21T10:22:26Z
parent: api-0zl4
blocked_by:
  - ps-38gq
---

M13 follow-up: replace throw new Error('No active session') on sync-engine.ts:221 with NoActiveSessionError. Requires WT5 and WT7 both merged.
