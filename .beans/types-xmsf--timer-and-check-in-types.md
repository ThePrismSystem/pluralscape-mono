---
# types-xmsf
title: Timer and check-in types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:25Z
updated_at: 2026-03-08T14:22:16Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Timer configuration and check-in record types for automated dissociation check-ins

## Scope

- `TimerConfig`: id (TimerId), systemId, intervalMinutes (number), wakingHoursOnly (boolean), wakingStart (time string, e.g. "08:00"), wakingEnd (time string, e.g. "22:00"), enabled (boolean)
- `CheckInRecord`: id, systemId, scheduledAt (UnixMillis), respondedAt (UnixMillis | null), respondedByMemberId (MemberId | null), dismissed (boolean)
- `CheckInPrompt`: configurable prompt text per system (e.g., "Who's fronting right now?")
- Timer triggers local notifications only — no server involvement (offline-first)
- Non-compulsive UX: dismissing without response is always an option

## Acceptance Criteria

- [ ] TimerConfig type with interval and waking hours
- [ ] CheckInRecord type with response tracking
- [ ] CheckInPrompt type for customizable text
- [ ] Waking hours boundary validation (start < end)
- [ ] Unit tests for type construction

## References

- features.md section 2 (Automated timers / dissociation check-ins)

## Audit Findings (002)

- TimerConfig missing `promptText` field directly (references CheckInPrompt separately but should include it)
