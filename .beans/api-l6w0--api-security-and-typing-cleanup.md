---
# api-l6w0
title: API security and typing cleanup
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:22Z
updated_at: 2026-04-17T05:46:31Z
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

## Summary of Changes

Completed via PR #457 (`fix(api): security, validation, and trust boundary hardening`).

- Removed `systemId`/`webhookId` from webhook test delivery payload (info disclosure)
- Cached `VERIFY_ENVELOPE_SIGNATURES` at startup; eliminated mutable one-shot flag in `ws/handlers.ts`
- sync-ge3a (M9) subsequently removed the `VERIFY_ENVELOPE_SIGNATURES` env var entirely; `ws/handlers.ts` no longer reads it.
