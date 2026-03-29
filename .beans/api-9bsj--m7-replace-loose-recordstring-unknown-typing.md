---
# api-9bsj
title: 'M7: Replace loose Record<string, unknown> typing'
status: todo
type: task
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T09:52:48Z
parent: api-hvub
---

webhook-config.service.ts:301 (update setFields) and webhook-delivery-worker.ts:64 (payload type). Should use Partial<NewWebhookConfig> and a branded/narrower type.
