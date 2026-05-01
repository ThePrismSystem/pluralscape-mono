---
# queue-x61z
title: Ratchet queue LOC cap from 775 to 500 (split bullmq-job-queue.ts)
status: todo
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T11:37:32Z
---

Tier B ratchet follow-up from ps-r5p7. Split packages/queue/src/adapters/bullmq/bullmq-job-queue.ts (currently 767 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 775 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md
