---
# ps-duny
title: Locale formatting utilities
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:36:19Z
updated_at: 2026-03-16T05:32:19Z
parent: ps-7z0s
blocked_by:
  - ps-jkpn
---

Date, time, number, and locale-aware formatting utilities

## Scope

- Date/time formatting: locale-aware via Intl.DateTimeFormat or date-fns
- Number formatting: Intl.NumberFormat
- Relative time: "3 hours ago", "yesterday" via Intl.RelativeTimeFormat
- Duration formatting: "2h 15m" for fronting session lengths
- RTL text direction detection and layout support (CSS/RN direction)
- Timezone handling for fronting timestamps

## Acceptance Criteria

- [x] Date formatting with locale support
- [x] Time formatting with locale support
- [x] Number formatting with locale support
- [x] Relative time formatting
- [x] Duration formatting for fronting sessions
- [x] RTL direction detection utility
- [x] Unit tests with multiple locales

## References

- features.md section 11

## Summary of Changes

Added locale formatting utilities to @pluralscape/i18n:

- formatDate/formatTime/formatDateTime with iso/us/eu/relative preferences
- formatNumber/formatCompactNumber/formatPercentage with locale-aware separators
- formatRelativeTime picking best unit (seconds through years)
- formatDuration/formatFrontingDuration for fronting session lengths
- Shared time-constants.ts eliminating all magic numbers
- 52 new tests across 4 test files, covering en/de/ar locales
