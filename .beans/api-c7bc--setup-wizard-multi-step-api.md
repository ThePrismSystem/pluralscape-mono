---
# api-c7bc
title: Setup wizard multi-step API
status: in-progress
type: task
priority: normal
created_at: 2026-03-16T11:56:58Z
updated_at: 2026-03-17T20:42:22Z
parent: api-c3a1
blocked_by:
  - api-6fv1
  - api-wq3i
---

POST .../setup/nomenclature (step 1). POST .../setup/profile (step 2). POST .../setup/complete (step 3: mark onboardingComplete, verify recovery key backup acknowledged). Each step idempotent.
