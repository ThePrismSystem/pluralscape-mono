---
# api-00ih
title: Chat proxy switching and @mentions
status: todo
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-ryy0
---

Proxy switching: message creation accepts senderId (member ref), validated against system membership. @mentions: polymorphic EntityReference<member|group|structure-entity> extracted from T3 metadata for notification routing. Mention targets: individual members, entire groups (notify all), structure entities. Tests: unit (mention validation per entity type, sender validation) + integration.
