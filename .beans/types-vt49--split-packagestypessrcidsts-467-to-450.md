---
# types-vt49
title: Split packages/types/src/ids.ts (467 to <=450)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:13Z
updated_at: 2026-04-30T22:49:53Z
parent: ps-r5p7
---

## Summary of Changes

Split ids.ts (467 LOC) into packages/types/src/ids/{brand,types,prefixes}.ts barrel pattern.
Original path remains as a 4-line barrel re-exporting Brand type and all ID types.
Files: brand.ts (9 LOC), types.ts (165 LOC), prefixes.ts (359 LOC), ids.ts barrel (4 LOC).
Typecheck, lint, tests (837/837), and types:check-sot all pass.
