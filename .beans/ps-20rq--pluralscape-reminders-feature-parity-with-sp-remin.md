---
# ps-20rq
title: Pluralscape reminders feature (parity with SP reminders)
status: todo
type: epic
priority: normal
created_at: 2026-04-08T12:07:04Z
updated_at: 2026-04-08T12:07:04Z
---

Add a generic reminders feature to Pluralscape so users can create named one-shot and recurring reminders, closing a parity gap with Simply Plural and PluralKit.

## Background

Pluralscape currently has `timer_configs` and `check_in_records` (packages/db/src/schema/pg/timers.ts), but those are a system-level check-in interval mechanism — not arbitrary user-named reminders. SP has both `automatedReminders` (one-shot) and `repeatedReminders` (recurring) as first-class user content. PluralKit has similar concepts.

The Simply Plural import (ps-nrg4) skips both reminder collections because there is no Pluralscape destination for them. Imported users see a summary warning that their reminders were not imported. This bean closes that gap.

## Scope

- Schema: new `reminders` table for one-shot reminders (`{name, message, scheduledAt, completed, completedAt, ...}`) and `repeating_reminders` for recurring reminders (`{name, message, intervalDays, timeOfDay, startDate, ...}`); both encrypted, both per-system, RLS-scoped
- Types: `Reminder`, `RepeatingReminder` in `@pluralscape/types`
- API: tRPC + REST CRUD endpoints
- Mobile data hooks (M8 pattern)
- UI: deferred to M11 buildout (this bean does not include screens)
- Notification scheduling: integrate with the existing notifications package or expo-notifications
- Migrations + RLS regen + dual-dialect integration tests
- Once shipped, follow-up: extend SP and PluralKit import mappers to include reminder collections

## Out of scope

- The actual SP/PK reminder import mappers (separate follow-up after this lands)
- The reminder UI screens (M11)
- Smart triggers, conditional reminders, or reminder templates (future iteration)

## Why this is a separate epic

Reminders are a brand-new Pluralscape feature, not an import-specific concern. Building them inside the SP import epic would expand scope dramatically and block import work on feature design. Tracking separately keeps both efforts clean.
