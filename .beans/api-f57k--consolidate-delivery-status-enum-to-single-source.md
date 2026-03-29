---
# api-f57k
title: Consolidate delivery status enum to single source
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

Delivery status is defined independently in packages/types/src/webhooks.ts, packages/validation/src/webhook.ts, and packages/db/src/helpers/enums.ts. Should import from a shared source to prevent drift when adding new statuses.
