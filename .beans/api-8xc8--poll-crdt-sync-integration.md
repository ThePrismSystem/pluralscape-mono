---
# api-8xc8
title: Poll CRDT sync integration
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:51:08Z
parent: api-8lt2
blocked_by:
  - api-6m3p
  - api-5cnc
---

Already part of ChatDocument (polls map, pollOptions map, votes append-only list). Verify wiring into sync engine. Tests: unit (merge behavior, vote append-only semantics, poll status LWW).

## Summary of Changes\n\nFixed poll-vote fieldName mismatch in CRDT strategy registry ('pollVotes' -> 'votes' to match ChatDocument schema). CRDT types and factory already correctly wired.
