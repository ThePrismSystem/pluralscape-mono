---
# api-za2j
title: M5 audit low-severity test and miscellaneous fixes
status: todo
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

Batch of low-severity test and miscellaneous findings from M5 audit.

## Tasks

- [ ] L15: Remove duplicate audit event tests in note/poll/acknowledgement integration files
- [ ] L16: Replace hard-coded voter/option IDs in E2E voting tests with UUIDs
- [ ] L17: Add webhook-config update route test
- [ ] L18: Remove unnecessary .returning() in webhook delivery cleanup (just need count)
- [ ] L19: Combine webhook delivery worker's 2 sequential queries into a JOIN
- [ ] L20: Pass full row to archive/restore hooks to avoid re-querying for channelId
- [ ] L21: Convert TODO in rotation.spec.ts:18 to a bean
- [ ] L22: Document DNS rebinding TOCTOU in webhook delivery (accepted risk)
- [ ] L23: Scope webhook secret variable to minimize log exposure risk
