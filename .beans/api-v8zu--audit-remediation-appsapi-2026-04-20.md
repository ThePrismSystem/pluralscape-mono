---
# api-v8zu
title: "Audit remediation: apps/api (2026-04-20)"
status: completed
type: epic
priority: high
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-20T12:47:41Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. See docs/local-audits/comprehensive-audit-2026-04-20/api.md for full findings. Tracking: ps-g937.

## Summary of Changes

Landed all 9 high-priority findings from the 2026-04-20 comprehensive audit for apps/api:

Security/correctness:

- api-qcs0 — completeTransfer now requires status='approved' instead of status='pending'
- api-trxh — ANTI_ENUM_SALT_SECRET moved into env.ts Zod schema with non-dev required + dev-default reject refinements
- api-2wjc — LocaleSchema/NamespaceSchema guards wired into Hono and tRPC i18n routes plus belt-and-braces at OTA service
- api-5y16 — friend dashboard queryVisibleEntities lifted from MAX_PAGE_LIMIT=100 to per-entity system quotas

Typing:

- api-hgd2 — WebhookConfigResult.cryptoKeyId branded ApiKeyId, WebhookConfigCreateResult.secretBytes branded ServerSecret

Test stability:

- api-vg8r — SSE integration test sleeps replaced with waitFor/waitForStable polling on observable conditions

Performance:

- api-0zzu — S3 blob cleanup deletes batched to 20-wide Promise.allSettled sub-batches
- api-njhu — fronting breakdown analytics aggregation pushed to Postgres GROUP BY over clamped-duration expression
- api-uo21 — notificationConfigs cached in switch-alert-dispatcher via QueryCache (60s TTL) with invalidation wired to mutation paths

Test-coverage beans (qnn6, rdko, lr6o, k6as) were reparented to M15 per plan.
