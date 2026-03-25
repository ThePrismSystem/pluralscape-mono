---
# api-jjb0
title: Communication webhooks
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T05:59:18Z
parent: ps-53up
---

Events for messages, board updates

## Scope

Register ~18 new webhook event types for all communication entity mutations. Wire into existing webhook dispatcher infrastructure (M4). Event types only — no new webhook config/delivery infrastructure needed. Payloads are T3 plaintext (IDs and metadata only, never encrypted content). Zero-knowledge compliant.

## Acceptance Criteria

- All communication event types registered: channel._, message._, board-message._, note._, poll._, poll-vote._, acknowledgement.\*
- T3 payload schemas defined for each event type
- Existing webhook dispatcher fires for communication events
- Unit tests: event type registration, payload schema validation
- Integration tests: dispatcher + delivery worker for communication events
- E2E tests: register webhook, trigger communication event, verify delivery

## Design References

- `apps/api/src/services/webhook-dispatcher.ts` — Existing dispatcher
- `docs/adr/025-webhook-secret-storage.md` — Webhook architecture
- `docs/adr/027-webhook-secret-rotation.md` — Secret rotation
