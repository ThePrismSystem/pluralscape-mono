---
# types-2xfo
title: Fronting analytics and reporting types
status: todo
type: task
priority: normal
created_at: 2026-03-08T18:49:46Z
updated_at: 2026-03-08T19:32:27Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-itej
---

Types for fronting analytics, report generation, and date range filtering.

## Scope

- `FrontingAnalytics`: systemId, dateRange (DateRange), memberBreakdowns (MemberFrontingBreakdown[])
- `MemberFrontingBreakdown`: memberId (MemberId), totalDuration (number — ms), averageSessionLength (number — ms), sessionCount (number), percentageOfTotal (number — 0-100)
- `FrontingReport`: id, systemId, dateRange (DateRange), memberBreakdowns, chartData (ChartData[]), format ('html' | 'pdf'), generatedAt (UnixMillis)
- `DateRangeFilter`: start (UnixMillis), end (UnixMillis), preset (DateRangePreset | null)
- `DateRangePreset`: 'last-7-days' | 'last-30-days' | 'last-90-days' | 'last-year' | 'all-time' | 'custom'
- `ChartData`: chartType ('pie' | 'bar' | 'timeline'), labels (string[]), datasets (ChartDataset[])
- `ChartDataset`: label (string), data (number[]), color (string)
- `Duration`: branded number type for millisecond durations
- All analytics computed client-side from decrypted fronting data

## Acceptance Criteria

- [ ] FrontingAnalytics with per-member breakdown
- [ ] DateRangeFilter with preset support
- [ ] ChartData for pie/bar/timeline rendering
- [ ] Duration branded type
- [ ] Unit tests for analytics helpers

## References

- features.md section 2 (Fronting and Analytics)
