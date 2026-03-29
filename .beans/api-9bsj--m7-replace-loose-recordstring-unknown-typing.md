---
# api-9bsj
title: "M7: Replace loose Record<string, unknown> typing"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

webhook-config.service.ts:301 (update setFields) and webhook-delivery-worker.ts:64 (payload type). Should use Partial<NewWebhookConfig> and a branded/narrower type.

## Summary of Changes\n\nReplaced Record<string, unknown> setFields with inline spread construction constraining keys. Kept payload param as Record for backwards compat.
