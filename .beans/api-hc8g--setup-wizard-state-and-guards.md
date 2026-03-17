---
# api-hc8g
title: Setup wizard state and guards
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:58Z
updated_at: 2026-03-17T21:41:58Z
parent: api-c3a1
blocked_by:
  - api-c7bc
---

GET .../setup/status (which steps complete, recovery key backed up). Complete endpoint rejects if recoveryKeyBackupConfirmed is false.

## Summary of Changes

- GET /setup/status returns completion flags for all steps
- Parallel queries for nomenclature, profile, settings, recovery key
- isComplete derived from all four boolean flags
