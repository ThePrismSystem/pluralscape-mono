---
# api-ojn1
title: "L11: Remove duplicate calculateBackoffMs/computeWebhookSignature tests"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

calculateBackoffMs and computeWebhookSignature tested identically in both unit and integration suites.

## Summary of Changes\n\nRemoved computeWebhookSignature and calculateBackoffMs describe blocks from integration test (pure functions already covered by unit tests).
