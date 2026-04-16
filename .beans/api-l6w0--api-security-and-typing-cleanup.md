---
# api-l6w0
title: API security and typing cleanup
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:22Z
updated_at: 2026-04-16T06:58:22Z
parent: ps-0enb
---

Low-severity API security and typing findings from comprehensive audit.

## Findings

- [ ] [API-S-L2] Webhook test delivery leaks systemId and webhookId
- [ ] [API-S-L3] completeTransfer reads key material before attempt-count lock (TOCTOU)
- [ ] [API-T-L2] ws/handlers.ts:372 reads VERIFY_ENVELOPE_SIGNATURES from process.env
- [ ] [API-P-L1] webhook-dispatcher.ts:95 deliveryIds: string[] should be WebhookDeliveryId[]
- [ ] [API-P-L2] hierarchy-service-types.ts — idPrefix, entityName, parentFieldName lack JSDoc
- [ ] [API-P-L3] ws/handlers.ts:370-382 module-level mutable boolean for one-shot warning
