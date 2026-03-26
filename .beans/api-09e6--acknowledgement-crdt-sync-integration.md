---
# api-09e6
title: Acknowledgement CRDT sync integration
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:34:48Z
parent: api-vjmu
blocked_by:
  - api-5wmv
---

Already in ChatDocument (acknowledgements map). LWW for confirmed/confirmedAt fields. Verify wiring into sync engine. Tests: unit (confirm merge semantics, LWW resolution).

## Summary of Changes\n\nVerified existing CRDT schema in `packages/sync/src/schemas/chat.ts`. `CrdtAcknowledgementRequest` has all LWW fields (confirmed, confirmedAt) and is correctly wired into `ChatDocument.acknowledgements` map. No code changes needed — schema was already complete.
