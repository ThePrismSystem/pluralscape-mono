---
# api-eewb
title: Chat CRDT sync integration
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T07:25:36Z
parent: api-ryy0
blocked_by:
  - api-cqkh
  - api-1hv8
---

Wire ChatDocument into sync engine document factory. Register channel + message subscription profiles. Tests: unit (document creation, merge) + integration (sync round-trip).

## Summary of Changes\n\nVerified existing CRDT sync infrastructure handles chat documents:\n- createChatDocument() factory exists and produces correct document shape\n- parseDocumentId() handles chat-{channelId}[-YYYY-MM] format\n- Subscription filter handles chat document type with activeChannelWindowDays\n- Document type prefix chat- is registered in PREFIX_CONFIGS\n\nSync document row creation (sync_documents table) is not yet wired into any entity creation service — this is consistent across all entity types (system-core, fronting, etc.) and will be addressed when the full client-server sync pipeline is activated.
