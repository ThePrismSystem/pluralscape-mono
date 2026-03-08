---
# types-2xfo
title: Fronting analytics and reporting types
status: todo
type: task
created_at: 2026-03-08T18:49:46Z
updated_at: 2026-03-08T18:49:46Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-itej
---

Types for fronting analytics and report generation: FrontingAnalytics (totalDuration, averageSessionLength, sessionCount per member), FrontingReport (dateRange, memberBreakdown, chartData), DateRangeFilter (start, end, presets like 'last-7-days'), ChartData (type, labels, datasets — for pie/bar chart rendering). All analytics computed client-side from decrypted fronting data.
