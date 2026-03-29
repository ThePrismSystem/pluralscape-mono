---
# api-hvgd
title: "L12: Replace heavy as never casts in webhook-config-enhancements.test.ts"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:32:16Z
parent: api-hvub
---

webhook-config-enhancements.test.ts uses heavy as never casts, masking potential type regressions.

## Summary of Changes\n\nReplaced 25+ as never casts with asDb(), makeTestAuth(), and typed AuditWriter mock.
