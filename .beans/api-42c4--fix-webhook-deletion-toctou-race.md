---
# api-42c4
title: Fix webhook deletion TOCTOU race
status: completed
type: bug
priority: low
created_at: 2026-03-24T21:49:46Z
updated_at: 2026-03-24T22:01:15Z
parent: ps-8al7
---

Webhook config deletion checks pending deliveries outside the deletion transaction. Move pending delivery count check inside transaction with FOR UPDATE to prevent confusing FK errors.

**Audit ref:** Finding 12 (LOW) — A04 Insecure Design / Tampering
**File:** apps/api/src/services/webhook-config.service.ts

## Summary of Changes

Added .for("update") to webhookConfigs row SELECT before counting pending deliveries in deleteWebhookConfig.
