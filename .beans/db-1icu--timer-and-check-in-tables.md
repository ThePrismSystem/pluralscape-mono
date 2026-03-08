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

Timer configuration and check-in record tables for automated dissociation check-ins.

## Scope

### Tables

- **`timer_configs`**: id (UUID PK), system_id (FK → systems, NOT NULL), enabled (boolean, T3, NOT NULL, default true), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — interval_minutes, waking_hours_only, waking_start, waking_end, prompt_text)
- **`check_in_records`**: id (UUID PK), system_id (FK → systems, NOT NULL), timer_config_id (FK → timer_configs, NOT NULL — links to triggering config), scheduled_at (T3, NOT NULL), responded_at (T3, nullable), dismissed (boolean, T3, NOT NULL, default false), encrypted_data (T1 — responded_by_member_id)

### Indexes

- timer_configs (system_id)
- check_in_records (system_id, scheduled_at)
- check_in_records (timer_config_id)

## Acceptance Criteria

- [ ] timer_configs with encrypted config and plaintext enabled flag
- [ ] check_in_records with timer_config_id FK to triggering config
- [ ] created_at/updated_at on timer_configs
- [ ] DEFAULT: enabled = true, dismissed = false
- [ ] Migrations for both dialects
- [ ] Integration test: create config, record check-in response linked to config

## References

- features.md section 2 (Automated timers / dissociation check-ins)
