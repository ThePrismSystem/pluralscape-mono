---
# db-pgjf
title: Split packages/db/src/helpers/enums.ts (610 to <=500)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:13Z
updated_at: 2026-04-30T22:32:11Z
parent: ps-r5p7
---

## Summary of Changes

Split helpers/enums.ts (610 LOC) into packages/db/src/helpers/enums/{api,auth,bucket,communication,import,job,member,notifications,sync,webhook}.ts barrel pattern.
Original path remains as barrel re-exporting all const arrays. All files ≤250 LOC. Typecheck, lint, unit tests (746 passed), integration tests (1592 passed), and types:check-sot all pass.
