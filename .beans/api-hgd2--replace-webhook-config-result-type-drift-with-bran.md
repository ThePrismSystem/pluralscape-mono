---
# api-hgd2
title: Replace Webhook Config result-type drift with branded types
status: completed
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:11:06Z
parent: api-v8zu
---

Findings [T1, T2, P1] from audit 2026-04-20. apps/api/src/services/webhook-config.service.ts:71,81. cryptoKeyId typed string|null should be ApiKeyId|null; secret typed string should be ServerSecret (opaque Uint8Array brand). Drift with canonical domain types in @pluralscape/types. Establish uniform branding across all \*Result interfaces.

## Summary of Changes

Branded WebhookConfigResult.cryptoKeyId as ApiKeyId | null (previously string | null) and introduced WebhookConfigCreateResult.secretBytes: ServerSecret alongside the existing base64 secret: string. Exported a toServerSecret helper that brands a fresh Uint8Array without an 'as unknown as' double-cast. Downstream tests now consume the branded types directly; the mock factories expose the same helper so fixtures don't need double-casts.
