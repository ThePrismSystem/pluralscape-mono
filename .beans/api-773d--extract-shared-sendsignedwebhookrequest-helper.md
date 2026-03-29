---
# api-773d
title: Extract shared sendSignedWebhookRequest helper
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

webhook-config.service.ts:607-654 and webhook-delivery-worker.ts:148-181 duplicate identical fetch + AbortController + signature logic. Extract a shared sendSignedWebhookRequest(url, payloadJson, secret, fetchFn) function.
