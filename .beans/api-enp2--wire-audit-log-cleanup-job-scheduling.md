---
# api-enp2
title: Wire audit log cleanup job scheduling
status: todo
type: task
priority: low
created_at: 2026-03-18T16:57:26Z
updated_at: 2026-03-18T16:57:26Z
---

Handler and cron constant exist (audit-log-cleanup.ts, job-schedules.constants.ts) but the entire job queue infrastructure is unwired. Needs queue/worker init in apps/api/src/index.ts, handler registration, repeatable job scheduling, and graceful shutdown. Blocked on BullMQ/Valkey infrastructure setup.
