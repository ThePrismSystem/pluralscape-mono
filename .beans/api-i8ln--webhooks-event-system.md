---
# api-i8ln
title: Webhooks event system
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:05Z
parent: ps-mmpz
---

Event system for front changes (encrypted payloads, extensible to other actions)

### Deletion pattern

Configs: API returns 409 HAS_DEPENDENTS if pending deliveries exist. Deliveries: leaf entities, auto-purge after 30 days. Archival always allowed regardless of dependents.
