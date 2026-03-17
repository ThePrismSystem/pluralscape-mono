---
# api-ryy0
title: Chat system
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:04Z
parent: ps-53up
---

Channels, proxy messaging, rich text, @mentions

### Deletion pattern

Channels: API returns 409 HAS_DEPENDENTS if child channels or messages exist. Messages/board messages: leaf entities, always deletable. Archival always allowed regardless of dependents.
