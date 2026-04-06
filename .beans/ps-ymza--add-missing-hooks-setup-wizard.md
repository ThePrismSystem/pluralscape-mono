---
# ps-ymza
title: "Add missing hooks: setup wizard"
status: completed
type: task
priority: high
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T02:44:11Z
parent: ps-y621
---

No hooks for the setup flow. Create hooks for systemSettingsRouter.setup sub-router:

- status check, nomenclature step, profile step, complete

Audit ref: Pass 1 HIGH

## Summary of Changes\n\nAdded 4 setup wizard hooks with tests. Online-only, invalidates systemSettings on each step.
