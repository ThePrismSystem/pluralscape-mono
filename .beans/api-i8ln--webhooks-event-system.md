---
# api-i8ln
title: Webhooks event system
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:05Z
parent: ps-mmpz
---

Event system for front changes (encrypted payloads, extensible to other actions)

### Deletion pattern

Configs: API returns 409 HAS_DEPENDENTS if pending deliveries exist. Deliveries: leaf entities, auto-purge after 30 days. Archival always allowed regardless of dependents.

## Summary of Changes

Implemented the complete webhooks event system:

- Webhook config CRUD with HMAC secret generation (api-a40k)
- Webhook delivery read/delete CRUD (api-u186)
- Event dispatcher for creating pending deliveries (api-xjt6)
- Delivery worker with HMAC signing and exponential backoff (api-flvl)
- Delivery cleanup job for terminal records (db-nh34)
- CRDT sync strategy with post-merge validation (sync-pgmk)
- Secret rotation documentation ADR (api-4pl2)
