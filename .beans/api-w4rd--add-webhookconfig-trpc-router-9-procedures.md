---
# api-w4rd
title: Add webhookConfig tRPC router (9 procedures)
status: completed
type: feature
priority: normal
created_at: 2026-04-02T09:47:02Z
updated_at: 2026-04-02T10:56:38Z
---

Create webhookConfigRouter with 9 procedures matching REST /webhook-configs/\* endpoints. Uses systemProcedure. Procedures: list, get, create, update, delete, archive, restore, rotateSecret, test. See audit Domain 15.

## Summary of Changes\n\nAdded webhookConfigRouter with 9 procedures to apps/api/src/trpc/routers/webhook-config.ts
