---
# api-enp2
title: Wire audit log cleanup job scheduling
status: scrapped
type: task
priority: low
created_at: 2026-03-18T16:57:26Z
updated_at: 2026-04-16T07:29:43Z
parent: api-tspr
---

Handler and cron constant exist (audit-log-cleanup.ts, job-schedules.constants.ts) but the entire job queue infrastructure is unwired. Needs queue/worker init in apps/api/src/index.ts, handler registration, repeatable job scheduling, and graceful shutdown. Blocked on BullMQ/Valkey infrastructure setup.

## Reasons for Scrapping

Merged into infra-gvgo which covers the same scope (scheduling audit log PII cleanup as a recurring job).
