---
# db-cybl
title: "Fix PR #65 review issues: schema type alignment"
status: completed
type: task
priority: normal
created_at: 2026-03-11T21:16:24Z
updated_at: 2026-04-16T07:29:37Z
parent: db-2nr7
---

Address all 8 review items from PR #65: SQLite chunks CHECK NULL bug, FRONTING_REPORT_FORMATS satisfies, memberIds non-empty CHECK, shared analytics types, ReportFormat $type, TABLE_PAIRS expansion, analytics test edge cases, constraint ordering

## Summary of Changes

1. Fixed SQLite chunks CHECK constraint to handle NULL chunksTotal (critical bug)
2. Added `satisfies readonly ReportFormat[]` to FRONTING_REPORT_FORMATS
3. Added memberIds non-empty CHECK constraint to switches table (PG + SQLite)
4. Extracted shared DbDateRange/DbMemberFrontingBreakdown/DbChartDataset/DbChartData interfaces
5. Used ReportFormat type in $type<>() for both analytics files
6. Expanded TABLE_PAIRS from 22 to 68 tables covering all shared tables
7. Added 3 analytics integration test edge cases per DB (FK, PK, multi-query)
8. Fixed frontingSessions constraint ordering in SQLite to match PG
