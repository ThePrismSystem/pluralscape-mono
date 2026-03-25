---
# api-00ih
title: Chat proxy switching and @mentions
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T07:23:04Z
parent: api-ryy0
blocked_by:
  - api-1hv8
---

Proxy switching: message creation accepts senderId (member ref), validated against system membership. @mentions: polymorphic EntityReference<member|group|structure-entity> extracted from T3 metadata for notification routing. Mention targets: individual members, entire groups (notify all), structure entities. Tests: unit (mention validation per entity type, sender validation) + integration.

## Summary of Changes\n\nNo API code changes needed. senderId and mentions are T1 encrypted (inside encryptedData blob) — the server is zero-knowledge and cannot validate these fields. Proxy switching and mention validation are client-side concerns. Follow-up bean client-ensq created under M8 for client-side implementation.
