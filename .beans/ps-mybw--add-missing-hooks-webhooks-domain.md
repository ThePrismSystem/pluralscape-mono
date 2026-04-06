---
# ps-mybw
title: "Add missing hooks: webhooks domain"
status: todo
type: task
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T00:52:27Z
parent: ps-y621
---

Zero hook coverage for webhooks. Create hooks wrapping:

- webhookConfigRouter: CRUD, archive/restore, secret rotation, test delivery
- webhookDeliveryRouter: list, get delivery log, delete delivery records

Audit ref: Pass 1 CRITICAL
