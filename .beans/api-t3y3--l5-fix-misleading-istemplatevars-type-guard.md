---
# api-t3y3
title: "L5: Fix misleading isTemplateVars type guard"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:26Z
parent: api-hvub
---

isTemplateVars type guard always returns true for any object — name misleading.

## Summary of Changes\n\nConverted isTemplateVars type guard to assertTemplateVars assertion function.
