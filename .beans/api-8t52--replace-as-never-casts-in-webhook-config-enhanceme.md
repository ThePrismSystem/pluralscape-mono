---
# api-8t52
title: Replace as never casts in webhook-config-enhancements tests
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

webhook-config-enhancements.test.ts uses mockTx as never and MOCK_AUTH as never heavily, bypassing type checking at test boundary. Use properly typed mock objects to catch type regressions.
