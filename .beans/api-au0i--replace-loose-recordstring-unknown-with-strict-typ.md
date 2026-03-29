---
# api-au0i
title: Replace loose Record<string, unknown> with strict types
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

Two locations use Record<string, unknown>: webhook-config.service.ts:301 (update setFields — use Partial<NewWebhookConfig>) and webhook-delivery-worker.ts:64 (payload — use branded/narrower JsonObject type).
