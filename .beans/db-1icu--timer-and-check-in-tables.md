---
# db-1icu
title: Timer and check-in tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:39Z
updated_at: 2026-03-08T14:21:27Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Timer configuration and check-in record tables

## Scope

- `timer_configs`: id, system_id, encrypted_data (T1 — interval_minutes, waking_hours_only, waking_start, waking_end, prompt_text), enabled (boolean — T3, needed for scheduling)
- `check_in_records`: id, system_id, scheduled_at (T3 — timestamp), responded_at (T3 — nullable timestamp), encrypted_data (T1 — responded_by_member_id), dismissed (boolean — T3)
- Design: timestamps are T3 (needed for timer scheduling); who responded is T1 (private)
- Indexes: timer_configs.system_id, check_in_records (system_id, scheduled_at)

## Acceptance Criteria

- [ ] timer_configs table with encrypted config and plaintext enabled flag
- [ ] check_in_records table with response tracking
- [ ] Indexes for efficient queries
- [ ] Migrations for both dialects
- [ ] Integration test: create config and record check-in response

## References

- features.md section 2 (Automated timers / dissociation check-ins)

## Audit Findings (002)

- Missing `timer_config_id` FK on check_in_records linking to the triggering config
- Missing `created_at`, `updated_at` on timer_configs
