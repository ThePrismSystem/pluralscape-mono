---
# api-hgd2
title: Replace Webhook Config result-type drift with branded types
status: todo
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Findings [T1, T2, P1] from audit 2026-04-20. apps/api/src/services/webhook-config.service.ts:71,81. cryptoKeyId typed string|null should be ApiKeyId|null; secret typed string should be ServerSecret (opaque Uint8Array brand). Drift with canonical domain types in @pluralscape/types. Establish uniform branding across all \*Result interfaces.
