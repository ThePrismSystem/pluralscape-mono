---
# ps-duny
title: Locale formatting utilities
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:36:19Z
updated_at: 2026-03-08T13:36:28Z
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

- [ ] Date formatting with locale support
- [ ] Time formatting with locale support
- [ ] Number formatting with locale support
- [ ] Relative time formatting
- [ ] Duration formatting for fronting sessions
- [ ] RTL direction detection utility
- [ ] Unit tests with multiple locales

## References

- features.md section 11
